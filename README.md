# Dale's PA - Voice Assistant

A production-ready Retell.ai + Claude voice personal assistant for Dale Purvis and Floor Giants Group. Built with Next.js, TypeScript, and integrations with Linear, Gmail, and Google Calendar.

## Features

- **Voice AI**: Powered by Retell.ai for natural speech-to-text transcription
- **Claude Integration**: Smart decision-making with full tool-use support
- **Email Management**: Gmail integration for email triage and drafting
- **Calendar Management**: Google Calendar integration for scheduling
- **Task Management**: Linear API integration for sprint tracking and issue management
- **Conversation Memory**: PostgreSQL database to track conversation history
- **Multi-call Types**: Morning, evening, and ad-hoc call workflows

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL (Neon recommended)
- API Keys:
  - Anthropic (Claude)
  - Retell.ai
  - Linear
  - Google OAuth credentials (Client ID, Secret, Refresh Token)

### Installation

```bash
# Clone and install
git clone <repo>
cd dale-pa
npm install

# Set up environment variables
cp .env.example .env.local

# Add your API keys to .env.local
# ANTHROPIC_API_KEY=sk-ant-...
# LINEAR_API_KEY=...
# GOOGLE_CLIENT_ID=...
# etc.

# Run the development server
npm run dev
```

Visit `http://localhost:3000` to see the dashboard.

### Deployment to Vercel

```bash
# Install Vercel CLI if you haven't already
npm i -g vercel

# Deploy with environment variables
vercel --prod --yes

# Or set env vars first:
vercel env add ANTHROPIC_API_KEY
vercel env add LINEAR_API_KEY
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
vercel env add GOOGLE_REFRESH_TOKEN
vercel env add DATABASE_URL
vercel env add RETELL_API_KEY

# Then deploy
vercel --prod --yes
```

## Architecture

### API Endpoints

- `POST /api/retell` - Main Retell.ai webhook for call events
- `GET /api/health` - Health check and integration status

### Core Libraries

- `src/lib/claude.ts` - Claude orchestration with tool use loop
- `src/lib/db.ts` - PostgreSQL connection and conversation storage
- `src/lib/tools/linear.ts` - Linear API interactions
- `src/lib/tools/gmail.ts` - Gmail API interactions
- `src/lib/tools/calendar.ts` - Google Calendar API interactions

### Frontend

- `src/app/page.tsx` - Dashboard with real-time integration status
- Dark theme with olive/green accents

## Retell Configuration

### Webhook URL

Configure Retell.ai with your deployment webhook URL:

```
POST https://your-domain.vercel.app/api/retell
```

### Agent Prompt

The system prompt is built into the code (see `src/lib/claude.ts`). It's based on Dale's personal assistant requirements from the config document.

### Custom Functions

All custom functions are implemented as Claude tools within the API endpoint. The following tools are available:

- `check_emails` - Search and retrieve emails from Gmail
- `draft_email` - Create email drafts for review
- `check_calendar` - List events for a given date
- `create_calendar_event` - Schedule new meetings
- `list_linear_issues` - Pull sprint status and issues
- `create_linear_issue` - Capture ideas and tasks
- `update_linear_issue` - Move work through the sprint

## Call Flows

### Morning Call (7:30-8am)

1. Email triage - summarize overnight emails
2. Calendar review - today's schedule
3. Sprint check - what's in progress, blocked, due
4. Brain dump capture - route ideas correctly
5. Agency check-in - Salience/DMP updates

### Evening Call (6pm)

1. Day debrief - what got done, what didn't
2. Quick wins - 2-3 things for tomorrow morning
3. EOD emails - replies that need sending

### Ad-hoc Calls

- Quick task capture
- Email composition
- Status checks

## Database

Uses PostgreSQL (Neon recommended) with two main tables:

- `conversation_messages` - Message history by call
- `call_records` - Call metadata and summaries

The database is auto-initialized on first API call.

## Tone & Voice

The agent is:
- Brief and to the point (no waffle)
- Warm but direct (northern mate vibes)
- Smart about business context
- Direct about problems
- Funny when it lands (not forced)

Key personality: "Sharp, efficient, and funny personal assistant for a busy business owner."

## Security

- All API keys stored in environment variables
- OAuth tokens handled securely
- Database SSL enabled in production
- Webhook signature verification (add if needed)

## Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint
npm run lint
```

## Monitoring

The dashboard at `/` shows:

- Real-time agent status (Live/Offline)
- Integration health (Linear, Gmail, Calendar)
- Recent call logs with duration and summary
- Last check timestamps

## Troubleshooting

### Agent Offline

Check `/api/health` endpoint for detailed integration status.

### Missing Emails

Ensure Gmail OAuth has appropriate scopes and refresh token is valid.

### Linear Issues Not Showing

Verify Linear API key and that the "Floor Giants" team exists with project key "FLO".

### Slow Response Times

- Check Claude API latency
- Consider batching tool calls (e.g., check emails AND calendar simultaneously)
- Review database query performance

## Future Improvements

- Call recording and analysis
- Advanced error recovery
- Multi-language support
- Custom call scheduling
- Reporting and analytics

## Support

For issues or questions, contact the development team.

---

**Built for Dale Purvis and Floor Giants Group**
Retell.ai + Claude + Next.js
