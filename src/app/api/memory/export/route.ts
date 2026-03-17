import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import {
  getRecentCallSummaries,
  getActiveMemories,
  getOpenFollowups,
} from '@/lib/memory';

/**
 * GET /api/memory/export
 *
 * Exports the PA's Postgres memories to MEMORY.md format.
 * This bridges the PA's call memory with the file-based memory
 * that Claude (Cowork) reads across sessions.
 *
 * Query params:
 *   ?write=true  — Write directly to MEMORY.md in project root
 *   (default)    — Return the markdown as a response
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shouldWrite = searchParams.get('write') === 'true';

    const [summaries, memories, followups] = await Promise.all([
      getRecentCallSummaries(20),
      getActiveMemories(1, 50),
      getOpenFollowups(20),
    ]);

    const lines: string[] = [];

    lines.push('# Memory');
    lines.push('');
    lines.push('> Persistent memory log for Dale\'s PA project. Auto-exported from Postgres.');
    lines.push(`> Last exported: ${new Date().toISOString().split('T')[0]}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Call summaries as log entries
    lines.push('## Log');
    lines.push('');
    if (summaries.length > 0) {
      for (const s of summaries) {
        const date = new Date(s.created_at || '').toISOString().split('T')[0];
        lines.push(`- **${date}** (${s.call_type}): ${s.summary}`);
        if (s.key_decisions && s.key_decisions.length > 0) {
          lines.push(`  - Decisions: ${(s.key_decisions as string[]).join('; ')}`);
        }
        if (s.action_items && s.action_items.length > 0) {
          lines.push(`  - Actions: ${(s.action_items as string[]).join('; ')}`);
        }
      }
    } else {
      lines.push('No calls recorded yet.');
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    // Key memories grouped by category
    lines.push('## Key Memories');
    lines.push('');
    if (memories.length > 0) {
      const grouped: Record<string, typeof memories> = {};
      for (const m of memories) {
        if (!grouped[m.category]) grouped[m.category] = [];
        grouped[m.category].push(m);
      }

      for (const [category, entries] of Object.entries(grouped)) {
        lines.push(`### ${category.charAt(0).toUpperCase() + category.slice(1)}s`);
        lines.push('');
        for (const entry of entries) {
          const stars = '★'.repeat(entry.importance);
          lines.push(`- ${stars} ${entry.summary}`);
          if (entry.details) {
            lines.push(`  - ${entry.details}`);
          }
        }
        lines.push('');
      }
    } else {
      lines.push('No memories stored yet.');
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    // Open follow-ups
    lines.push('## Open Items');
    lines.push('');
    if (followups.length > 0) {
      for (const f of followups) {
        const date = new Date(f.created_at || '').toISOString().split('T')[0];
        lines.push(`- [ ] [${date}] ${f.summary}`);
      }
    } else {
      lines.push('No open follow-ups.');
    }

    const markdown = lines.join('\n');

    if (shouldWrite) {
      const memoryPath = join(process.cwd(), 'MEMORY.md');
      await writeFile(memoryPath, markdown, 'utf-8');
      return NextResponse.json({
        status: 'written',
        path: memoryPath,
        summaryCount: summaries.length,
        memoryCount: memories.length,
        followupCount: followups.length,
      });
    }

    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': 'inline; filename="MEMORY.md"',
      },
    });
  } catch (err) {
    console.error('Memory export error:', err);
    return NextResponse.json(
      { error: 'Export failed', details: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    );
  }
}
