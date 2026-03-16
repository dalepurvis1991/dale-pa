'use client';

import { useState, useEffect } from 'react';

interface CallLog {
  id: string;
  call_id: string;
  timestamp: string;
  duration_seconds: number;
  type: 'morning' | 'evening' | 'adhoc';
  summary: string;
}

export default function Home() {
  const [isLive, setIsLive] = useState(false);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [integrations, setIntegrations] = useState({
    linear: { connected: false, lastCheck: null as string | null },
    gmail: { connected: false, lastCheck: null as string | null },
    calendar: { connected: false, lastCheck: null as string | null },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        setIsLive(data.status === 'ok');
        setIntegrations(data.integrations || integrations);
      } catch (err) {
        console.error('Health check failed:', err);
        setIsLive(false);
      } finally {
        setLoading(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-GB', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">🎧</div>
          <p className="text-slate-400">Booting up...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-4xl">🎧</div>
              <div>
                <h1 className="text-3xl font-bold text-white">Dale's PA</h1>
                <p className="text-sm text-slate-400">Retell.ai + Claude Voice Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div
                className={`status-indicator ${
                  isLive ? 'status-active' : 'status-inactive'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                {isLive ? 'Agent Live' : 'Offline'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Integration Status */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-white mb-4">Integrations</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-200">Linear</h3>
                <div
                  className={`status-indicator ${
                    integrations.linear.connected ? 'status-active' : 'status-inactive'
                  }`}
                >
                  {integrations.linear.connected ? 'Connected' : 'Offline'}
                </div>
              </div>
              <p className="text-sm text-slate-400">Floor Giants sprint management</p>
              {integrations.linear.lastCheck && (
                <p className="text-xs text-slate-500 mt-2">
                  Last: {new Date(integrations.linear.lastCheck).toLocaleTimeString()}
                </p>
              )}
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-200">Gmail</h3>
                <div
                  className={`status-indicator ${
                    integrations.gmail.connected ? 'status-active' : 'status-inactive'
                  }`}
                >
                  {integrations.gmail.connected ? 'Connected' : 'Offline'}
                </div>
              </div>
              <p className="text-sm text-slate-400">Email triage & drafting</p>
              {integrations.gmail.lastCheck && (
                <p className="text-xs text-slate-500 mt-2">
                  Last: {new Date(integrations.gmail.lastCheck).toLocaleTimeString()}
                </p>
              )}
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-200">Google Calendar</h3>
                <div
                  className={`status-indicator ${
                    integrations.calendar.connected ? 'status-active' : 'status-inactive'
                  }`}
                >
                  {integrations.calendar.connected ? 'Connected' : 'Offline'}
                </div>
              </div>
              <p className="text-sm text-slate-400">Schedule management</p>
              {integrations.calendar.lastCheck && (
                <p className="text-xs text-slate-500 mt-2">
                  Last: {new Date(integrations.calendar.lastCheck).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Call Logs */}
        <section>
          <h2 className="text-xl font-bold text-white mb-4">Recent Calls</h2>
          {callLogs.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-slate-400">No calls yet. Agent is ready to take your first call.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {callLogs.map((log) => (
                <div key={log.id} className="card hover:bg-slate-800/50 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-olive-600/30 text-olive-300">
                          {log.type === 'morning'
                            ? '🌅 Morning'
                            : log.type === 'evening'
                              ? '🌆 Evening'
                              : '⚡ Ad-hoc'}
                        </span>
                        <span className="text-sm text-slate-400">{formatTime(log.timestamp)}</span>
                      </div>
                      <p className="text-slate-200">{log.summary}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">{formatDuration(log.duration_seconds)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-slate-800 text-center text-slate-500 text-sm">
          <p>
            Built with Retell.ai + Claude for{' '}
            <span className="font-semibold text-slate-400">Floor Giants Group</span>
          </p>
          <p className="mt-2">
            Scheduled calls: 7:30am & 6pm daily | Ad-hoc available 24/7
          </p>
        </footer>
      </div>
    </main>
  );
}
