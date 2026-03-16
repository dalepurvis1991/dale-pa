import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export interface Message {
  id?: string;
  call_id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp?: string;
}

export interface CallRecord {
  id?: string;
  call_id: string;
  type: 'morning' | 'evening' | 'adhoc';
  duration_seconds: number;
  summary: string;
  created_at?: string;
}

let dbInitialized = false;

async function initializeDatabase() {
  if (dbInitialized) return;

  try {
    const client = await pool.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id SERIAL PRIMARY KEY,
        call_id VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (call_id) REFERENCES call_records(call_id) ON DELETE CASCADE
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS call_records (
        call_id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        duration_seconds INT DEFAULT 0,
        summary TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_call_id ON conversation_messages(call_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_call_records_created ON call_records(created_at DESC);
    `);

    client.release();
    dbInitialized = true;
  } catch (err) {
    console.error('Database initialization error:', err);
    throw err;
  }
}

export async function saveMessage(message: Message): Promise<void> {
  await initializeDatabase();

  const client = await pool.connect();
  try {
    await client.query(
      'INSERT INTO conversation_messages (call_id, role, content) VALUES ($1, $2, $3)',
      [message.call_id, message.role, message.content]
    );
  } finally {
    client.release();
  }
}

export async function getConversationHistory(callId: string): Promise<Message[]> {
  await initializeDatabase();

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT call_id, role, content, timestamp FROM conversation_messages WHERE call_id = $1 ORDER BY timestamp ASC',
      [callId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function createCallRecord(record: CallRecord): Promise<void> {
  await initializeDatabase();

  const client = await pool.connect();
  try {
    await client.query(
      'INSERT INTO call_records (call_id, type, duration_seconds, summary) VALUES ($1, $2, $3, $4)',
      [record.call_id, record.type, record.duration_seconds, record.summary]
    );
  } finally {
    client.release();
  }
}

export async function updateCallRecord(callId: string, updates: Partial<CallRecord>): Promise<void> {
  await initializeDatabase();

  const client = await pool.connect();
  try {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (updates.duration_seconds !== undefined) {
      fields.push(`duration_seconds = $${paramCount++}`);
      values.push(updates.duration_seconds);
    }
    if (updates.summary !== undefined) {
      fields.push(`summary = $${paramCount++}`);
      values.push(updates.summary);
    }

    if (fields.length > 0) {
      values.push(callId);
      await client.query(
        `UPDATE call_records SET ${fields.join(', ')} WHERE call_id = $${paramCount}`,
        values
      );
    }
  } finally {
    client.release();
  }
}

export async function getRecentCalls(limit: number = 10): Promise<CallRecord[]> {
  await initializeDatabase();

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT call_id, type, duration_seconds, summary, created_at FROM call_records ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function deleteConversationMessages(callId: string): Promise<void> {
  await initializeDatabase();

  const client = await pool.connect();
  try {
    await client.query('DELETE FROM conversation_messages WHERE call_id = $1', [callId]);
  } finally {
    client.release();
  }
}
