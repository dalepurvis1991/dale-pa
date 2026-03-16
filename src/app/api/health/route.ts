import { NextResponse } from 'next/server';

export async function GET() {
  const integrations = {
    linear: {
      connected: !!process.env.LINEAR_API_KEY,
      lastCheck: new Date().toISOString(),
    },
    gmail: {
      connected:
        !!process.env.GOOGLE_CLIENT_ID &&
        !!process.env.GOOGLE_CLIENT_SECRET &&
        !!process.env.GOOGLE_REFRESH_TOKEN,
      lastCheck: new Date().toISOString(),
    },
    calendar: {
      connected:
        !!process.env.GOOGLE_CLIENT_ID &&
        !!process.env.GOOGLE_CLIENT_SECRET &&
        !!process.env.GOOGLE_REFRESH_TOKEN,
      lastCheck: new Date().toISOString(),
    },
  };

  const isHealthy =
    !!process.env.ANTHROPIC_API_KEY &&
    integrations.linear.connected &&
    integrations.gmail.connected &&
    integrations.calendar.connected;

  return NextResponse.json({
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    integrations,
    checks: {
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      retell: !!process.env.RETELL_API_KEY,
      database: !!process.env.DATABASE_URL,
    },
  });
}
