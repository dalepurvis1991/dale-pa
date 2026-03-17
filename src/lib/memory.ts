import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ── Types ────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id?: number;
  call_id: string;
  category: 'decision' | 'task' | 'idea' | 'person' | 'preference' | 'context' | 'followup';
  summary: string;
  details?: string;
  tags?: string[];
  importance: number; // 1-5, higher = more important
  expires_at?: string | null; // null = never expires
  created_at?: string;
}

export interface CallSummary {
  id?: number;
  call_id: string;
  call_type: 'morning' | 'evening' | 'adhoc';
  summary: string;
  key_decisions: string[];
  action_items: string[];
  topics_discussed: string[];
  mood?: string;
  created_at?: string;
}

// ── Schema Init ──────────────────────────────────────────────────────────

let memoryTablesInitialized = false;

export async function initMemoryTables(): Promise<void> {
  if (memoryTablesInitialized) return;

  const client = await pool.connect();
  try {
    // Call summaries — one per call, generated at call_ended
    await client.query(`
      CREATE TABLE IF NOT EXISTS call_summaries (
        id SERIAL PRIMARY KEY,
        call_id VARCHAR(255) NOT NULL UNIQUE,
        call_type VARCHAR(50) NOT NULL,
        summary TEXT NOT NULL,
        key_decisions JSONB DEFAULT '[]',
        action_items JSONB DEFAULT '[]',
        topics_discussed JSONB DEFAULT '[]',
        mood VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Granular memory entries — facts, decisions, preferences, people notes
    await client.query(`
      CREATE TABLE IF NOT EXISTS memory_entries (
        id SERIAL PRIMARY KEY,
        call_id VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        summary TEXT NOT NULL,
        details TEXT,
        tags JSONB DEFAULT '[]',
        importance INT DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Indexes for fast retrieval
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_call_summaries_created
        ON call_summaries(created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memory_entries_category
        ON memory_entries(category, importance DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memory_entries_tags
        ON memory_entries USING GIN(tags);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memory_entries_created
        ON memory_entries(created_at DESC);
    `);

    memoryTablesInitialized = true;
  } catch (err) {
    console.error('Memory tables init error:', err);
    throw err;
  } finally {
    client.release();
  }
}

// ── Save Operations ──────────────────────────────────────────────────────

export async function saveCallSummary(summary: CallSummary): Promise<void> {
  await initMemoryTables();
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO call_summaries (call_id, call_type, summary, key_decisions, action_items, topics_discussed, mood)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (call_id) DO UPDATE SET
         summary = EXCLUDED.summary,
         key_decisions = EXCLUDED.key_decisions,
         action_items = EXCLUDED.action_items,
         topics_discussed = EXCLUDED.topics_discussed,
         mood = EXCLUDED.mood`,
      [
        summary.call_id,
        summary.call_type,
        summary.summary,
        JSON.stringify(summary.key_decisions),
        JSON.stringify(summary.action_items),
        JSON.stringify(summary.topics_discussed),
        summary.mood || null,
      ]
    );
  } finally {
    client.release();
  }
}

export async function saveMemoryEntry(entry: MemoryEntry): Promise<number> {
  await initMemoryTables();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO memory_entries (call_id, category, summary, details, tags, importance, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        entry.call_id,
        entry.category,
        entry.summary,
        entry.details || null,
        JSON.stringify(entry.tags || []),
        entry.importance,
        entry.expires_at || null,
      ]
    );
    return result.rows[0].id;
  } finally {
    client.release();
  }
}

export async function saveMemoryEntries(entries: MemoryEntry[]): Promise<void> {
  await initMemoryTables();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const entry of entries) {
      await client.query(
        `INSERT INTO memory_entries (call_id, category, summary, details, tags, importance, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          entry.call_id,
          entry.category,
          entry.summary,
          entry.details || null,
          JSON.stringify(entry.tags || []),
          entry.importance,
          entry.expires_at || null,
        ]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Retrieval Operations ─────────────────────────────────────────────────

/** Get the last N call summaries (most recent first) */
export async function getRecentCallSummaries(limit: number = 5): Promise<CallSummary[]> {
  await initMemoryTables();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT call_id, call_type, summary, key_decisions, action_items, topics_discussed, mood, created_at
       FROM call_summaries
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

/** Get high-importance memory entries that haven't expired */
export async function getActiveMemories(
  minImportance: number = 3,
  limit: number = 20
): Promise<MemoryEntry[]> {
  await initMemoryTables();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, call_id, category, summary, details, tags, importance, expires_at, created_at
       FROM memory_entries
       WHERE importance >= $1
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY importance DESC, created_at DESC
       LIMIT $2`,
      [minImportance, limit]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

/** Get memories by category */
export async function getMemoriesByCategory(
  category: MemoryEntry['category'],
  limit: number = 10
): Promise<MemoryEntry[]> {
  await initMemoryTables();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, call_id, category, summary, details, tags, importance, expires_at, created_at
       FROM memory_entries
       WHERE category = $1
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY importance DESC, created_at DESC
       LIMIT $2`,
      [category, limit]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

/** Search memories by tag */
export async function searchMemoriesByTag(tag: string, limit: number = 10): Promise<MemoryEntry[]> {
  await initMemoryTables();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, call_id, category, summary, details, tags, importance, expires_at, created_at
       FROM memory_entries
       WHERE tags @> $1
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY importance DESC, created_at DESC
       LIMIT $2`,
      [JSON.stringify([tag]), limit]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

/** Get open follow-ups and action items */
export async function getOpenFollowups(limit: number = 15): Promise<MemoryEntry[]> {
  await initMemoryTables();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, call_id, category, summary, details, tags, importance, expires_at, created_at
       FROM memory_entries
       WHERE category IN ('followup', 'task')
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY importance DESC, created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

// ── Context Builder ──────────────────────────────────────────────────────
// This is the key function — builds a memory context block to inject into
// the system prompt before each conversation turn.

export async function buildMemoryContext(): Promise<string> {
  const [recentCalls, activeMemories, followups] = await Promise.all([
    getRecentCallSummaries(5),
    getActiveMemories(3, 15),
    getOpenFollowups(10),
  ]);

  const sections: string[] = [];

  // Recent call summaries
  if (recentCalls.length > 0) {
    sections.push('## Recent Calls');
    for (const call of recentCalls) {
      const date = new Date(call.created_at || '').toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      sections.push(`**${call.call_type.toUpperCase()} — ${date}**: ${call.summary}`);
      if (call.action_items && call.action_items.length > 0) {
        sections.push(`Action items: ${(call.action_items as string[]).join('; ')}`);
      }
    }
  }

  // Key memories (decisions, preferences, people notes)
  if (activeMemories.length > 0) {
    const grouped: Record<string, MemoryEntry[]> = {};
    for (const mem of activeMemories) {
      if (!grouped[mem.category]) grouped[mem.category] = [];
      grouped[mem.category].push(mem);
    }

    sections.push('\n## Key Context');
    for (const [category, entries] of Object.entries(grouped)) {
      sections.push(`**${category.charAt(0).toUpperCase() + category.slice(1)}s:**`);
      for (const entry of entries) {
        sections.push(`- ${entry.summary}`);
      }
    }
  }

  // Open follow-ups
  if (followups.length > 0) {
    sections.push('\n## Open Follow-ups');
    for (const fu of followups) {
      const date = new Date(fu.created_at || '').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      });
      sections.push(`- [${date}] ${fu.summary}`);
    }
  }

  if (sections.length === 0) {
    return '';
  }

  return `\n\n--- MEMORY CONTEXT (from previous calls) ---\n${sections.join('\n')}\n--- END MEMORY CONTEXT ---`;
}

// ── Cleanup ──────────────────────────────────────────────────────────────

/** Remove expired memory entries */
export async function cleanupExpiredMemories(): Promise<number> {
  await initMemoryTables();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `DELETE FROM memory_entries WHERE expires_at IS NOT NULL AND expires_at < NOW()`
    );
    return result.rowCount || 0;
  } finally {
    client.release();
  }
}
