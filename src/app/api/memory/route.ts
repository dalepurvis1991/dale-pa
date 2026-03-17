import { NextRequest, NextResponse } from 'next/server';
import {
  getRecentCallSummaries,
  getActiveMemories,
  getOpenFollowups,
  getMemoriesByCategory,
  searchMemoriesByTag,
  type MemoryEntry,
  type CallSummary,
} from '@/lib/memory';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as MemoryEntry['category'] | null;
    const tag = searchParams.get('tag');
    const type = searchParams.get('type'); // 'summaries' | 'memories' | 'followups' | 'all'

    if (tag) {
      const memories = await searchMemoriesByTag(tag, 20);
      return NextResponse.json({ memories });
    }

    if (category) {
      const memories = await getMemoriesByCategory(category, 20);
      return NextResponse.json({ memories });
    }

    if (type === 'summaries') {
      const summaries = await getRecentCallSummaries(20);
      return NextResponse.json({ summaries });
    }

    if (type === 'followups') {
      const followups = await getOpenFollowups(20);
      return NextResponse.json({ followups });
    }

    // Default: return everything
    const [summaries, memories, followups] = await Promise.all([
      getRecentCallSummaries(10),
      getActiveMemories(1, 30),
      getOpenFollowups(15),
    ]);

    return NextResponse.json({ summaries, memories, followups });
  } catch (err) {
    console.error('Memory API error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch memories', details: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    );
  }
}
