'use client';

import { useState, useEffect, useCallback } from 'react';

interface CallSummary {
  call_id: string;
  call_type: 'morning' | 'evening' | 'adhoc';
  summary: string;
  key_decisions: string[];
  action_items: string[];
  topics_discussed: string[];
  mood: string;
  created_at: string;
}

interface MemoryEntry {
  id: number;
  call_id: string;
  category: string;
  summary: string;
  details: string | null;
  tags: string[];
  importance: number;
  expires_at: string | null;
  created_at: string;
}

type Tab = 'all' | 'summaries' | 'memories' | 'followups';
type Category = 'all' | 'decision' | 'task' | 'idea' | 'person' | 'preference' | 'context' | 'followup';

export default function MemoryDashboard() {
  const [tab, setTab] = useState<Tab>('all');
  const [categoryFilter, setCategoryFilter] = useState<Category>('all');
  const [summaries, setSummaries] = useState<CallSummary[]>([]);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [followups, setFollowups] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let url = '/api/memory';
      const params = new URLSearchParams();

      if (tab !== 'all') {
        params.set('type', tab);
      }

      if (categoryFilter !== 'all' && (tab === 'memories' || tab === 'all')) {
        params.set('category', categoryFilter);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setSummaries(data.summaries || []);
      setMemories(data.memories || []);
      setFollowups(data.followups || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [tab, categoryFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const callTypeColors: Record<string, string> = {
    morning: 'bg-amber-100 text-amber-800',
    evening: 'bg-indigo-100 text-indigo-800',
    adhoc: 'bg-gray-100 text-gray-700',
  };

  const categoryColors: Record<string, string> = {
    decision: 'bg-green-100 text-green-800',
    task: 'bg-blue-100 text-blue-800',
    idea: 'bg-purple-100 text-purple-800',
    person: 'bg-orange-100 text-orange-800',
    preference: 'bg-pink-100 text-pink-800',
    context: 'bg-gray-100 text-gray-700',
    followup: 'bg-red-100 text-red-800',
  };

  const importanceStars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">PA Memory</h1>
            <p className="text-sm text-gray-500">What your PA remembers from calls</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Refresh
            </button>
            <a
              href="/"
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              Dashboard
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
          {(['all', 'summaries', 'memories', 'followups'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                tab === t
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t === 'all' ? 'Everything' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Category filter (for memories tab) */}
        {(tab === 'memories' || tab === 'all') && (
          <div className="flex gap-2 mb-6 flex-wrap">
            {(['all', 'decision', 'task', 'idea', 'person', 'preference', 'context', 'followup'] as Category[]).map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  categoryFilter === c
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {c === 'all' ? 'All categories' : c}
              </button>
            ))}
          </div>
        )}

        {/* Loading / Error */}
        {loading && (
          <div className="text-center py-12 text-gray-500">Loading memories...</div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-700">Error: {error}</p>
            <p className="text-xs text-red-500 mt-1">
              Database may not be connected yet. Check your DATABASE_URL env var.
            </p>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-8">
            {/* Call Summaries */}
            {(tab === 'all' || tab === 'summaries') && summaries.length > 0 && (
              <section>
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Recent Calls
                </h2>
                <div className="space-y-3">
                  {summaries.map((s) => (
                    <div
                      key={s.call_id}
                      className="bg-white rounded-lg border border-gray-200 p-4"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${callTypeColors[s.call_type]}`}>
                          {s.call_type}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDate(s.created_at)}
                        </span>
                        {s.mood && (
                          <span className="text-xs text-gray-400">
                            Mood: {s.mood}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 mb-3">{s.summary}</p>

                      {s.key_decisions?.length > 0 && (
                        <div className="mb-2">
                          <span className="text-xs font-medium text-gray-500">Decisions: </span>
                          <span className="text-xs text-gray-700">
                            {s.key_decisions.join(' · ')}
                          </span>
                        </div>
                      )}

                      {s.action_items?.length > 0 && (
                        <div className="mb-2">
                          <span className="text-xs font-medium text-gray-500">Actions: </span>
                          <span className="text-xs text-gray-700">
                            {s.action_items.join(' · ')}
                          </span>
                        </div>
                      )}

                      {s.topics_discussed?.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {s.topics_discussed.map((topic, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 text-xs bg-gray-50 text-gray-600 rounded"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Open Follow-ups */}
            {(tab === 'all' || tab === 'followups') && followups.length > 0 && (
              <section>
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Open Follow-ups
                </h2>
                <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {followups.map((f) => (
                    <div key={f.id} className="px-4 py-3 flex items-start gap-3">
                      <span className="text-xs text-amber-500 font-mono mt-0.5">
                        {importanceStars(f.importance)}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-800">{f.summary}</p>
                        {f.details && (
                          <p className="text-xs text-gray-500 mt-1">{f.details}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatDate(f.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Memory Entries */}
            {(tab === 'all' || tab === 'memories') && memories.length > 0 && (
              <section>
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Memory Bank
                </h2>
                <div className="space-y-2">
                  {memories.map((m) => (
                    <div
                      key={m.id}
                      className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-start gap-3"
                    >
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium whitespace-nowrap ${categoryColors[m.category] || 'bg-gray-100 text-gray-600'}`}>
                        {m.category}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800">{m.summary}</p>
                        {m.details && (
                          <p className="text-xs text-gray-500 mt-1">{m.details}</p>
                        )}
                        {m.tags?.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {m.tags.map((tag, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 text-xs bg-gray-50 text-gray-500 rounded"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <span className="text-xs text-amber-500 font-mono block">
                          {importanceStars(m.importance)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDate(m.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {!loading && summaries.length === 0 && memories.length === 0 && followups.length === 0 && (
              <div className="text-center py-16">
                <p className="text-gray-400 text-sm">No memories yet.</p>
                <p className="text-gray-400 text-xs mt-1">
                  They'll appear here after your first call with the PA.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
