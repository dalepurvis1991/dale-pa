# Deployment Guide - Dale's PA

This guide walks through deploying Dale's Personal Assistant to production using Vercel and setting up all required integrations.

## Prerequisites

Before deploying, you'll need:

1. **Vercel Account** - Create at https://vercel.com
2. **Neon PostgreSQL** - Create database at https://neon.tech
3. **API Keys**:
   - Anthropic Claude API key from https://console.anthropic.com
   - Retell.ai API key from https://retell.ai
   - Linear API key from https://linear.app/settings/api
   - Google OAuth credentials (see section below)

## Step 1: Set Up Google OAuth

Google OAuth is needed for Gmail and Calendar access.

### Create Google Cloud Project

1. Go to https://console.cloud.google.com
2. Create a new project (e.g., "Dale's PA")
3. Enable the following APIs:
   - Gmail API
   - Google Calendar API
4. Create an OAuth 2.0 Client ID:
   - Go to "Credentials" → "Create Credentials" → "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback` (for local testing)
     - `https://your-vercel-domain.vercel.app/api/auth/callback` (after deployment)
   - Save your Client ID and Client Secret

### Get Google Refresh Token

1. Use Google's OAuth 2.0 Playground: https://developers.google.com/oauthplayground
2. Select the Gmail and Calendar scopes you need
3. Authorize and exchange the authorization code for a refresh token
4. Copy the refresh token (this is what you'll use in .env)

**Alternatively**, use this script to generate a refresh token locally:

```bash
# Create a file: get_refresh_token.js
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  'YOUR_CLIENT_ID',
  'YOUR_CLIENT_SECRET',
  'http://localhost:3000/api/auth/callback'
);

const scopes = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar',
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
});

console.log('Authorize this app by visiting this url:', authUrl);
```

## Step 2: Set Up Neon PostgreSQL

1. Go to https://neon.tech and create an account
2. Create a new project
3. Create a database (e.g., "dale_pa")
4. Copy the connection string (looks like: `postgresql://user:password@host/dbname`)
5. Keep this safe - you'll add it to Vercel env vars

## Step 3: Local Testing

Before deploying, test locally:

```bash
# Clone the repo
cd dale-pa

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your API keys:
ANTHROPIC_API_KEY=sk-ant-...
RETELL_API_KEY=...
LINEAR_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
DATABASE_URL=postgresql://...
```

Install and run:

```bash
npm install
npm run dev
```

Visit http://localhost:3000 to see the dashboard.

Test the health check:
```bash
curl http://localhost:3000/api/health
```

You should see all integrations as `connected: true`.

## Step 4: Deploy to Vercel

### Option A: Using Vercel CLI

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from the project directory
cd dale-pa
vercel --prod --yes
```

### Option B: Using Vercel Dashboard

1. Push code to GitHub
2. Go to https://vercel.com/dashboard
3. Click "Add New" → "Project"
4. Select your GitHub repo
5. Click "Deploy"
6. Add environment variables in Project Settings → Environment Variables

### Add Environment Variables to Vercel

Go to your Vercel project settings and add:

```
ANTHROPIC_API_KEY=sk-ant-...
LINEAR_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
DATABASE_URL=postgresql://...
RETELL_API_KEY=...
NODE_ENV=production
```

**Important**: Mark `DATABASE_URL` and `GOOGLE_REFRESH_TOKEN` as "Sensitive" to keep them encrypted.

## Step 5: Configure Retell.ai

1. Go to https://retell.ai/dashboard
2. Create a new agent or update existing one
3. Set the webhook URL to:
   ```
   https://your-vercel-domain.vercel.app/api/retell
   ```
4. The system prompt is handled by the code (in `src/lib/claude.ts`)
5. Configure voice settings:
   - Voice: British male, neutral UK English
   - Interruption handling: Enabled
   - Sample rate: 16kHz+

## Step 6: Test Deployment

Once deployed:

1. Visit your Vercel domain
2. Check the health endpoint:
   ```
   https://your-domain.vercel.app/api/health
   ```
3. All integrations should show as `connected: true`
4. The dashboard should display "Agent Live" status

## Step 7: Set Up Call Scheduling

You can set up scheduled calls in two ways:

### Option A: Retell.ai Scheduled Calls

Configure recurring calls in Retell's dashboard:
- Morning call: 7:30am daily
- Evening call: 6pm daily

### Option B: External Scheduler (AWS Lambda, Zapier, etc.)

Create webhooks that call:
```
POST https://your-domain.vercel.app/api/retell
```

With payload:
```json
{
  "event": "call_analyzed",
  "call_id": "morning-2026-03-15",
  "response_id": "...",
  "user_message": "Morning, what do we have?"
}
```

## Monitoring & Maintenance

### Check Integration Status

```bash
curl https://your-domain.vercel.app/api/health
```

### View Logs

Vercel automatically logs all requests. View them:
1. Go to Vercel Dashboard
2. Select your project
3. Click "Deployments" or "Logs"
4. Filter by endpoint

### Monitor Database

From Neon dashboard:
1. Check query performance
2. Monitor connection count
3. Set up alerts for database issues

### Test Tools Manually

To test that tools work, call the Retell webhook directly:

```bash
curl -X POST https://your-domain.vercel.app/api/retell \
  -H "Content-Type: application/json" \
  -d '{
    "event": "call_analyzed",
    "call_id": "test-call-1",
    "response_id": "test-123",
    "user_message": "What emails do I have?"
  }'
```

You should get back a JSON response with Claude's reply.

## Troubleshooting

### "Agent Offline"

Check the health endpoint. If integrations show as `false`:

1. **Linear**: Verify API key is correct and hasn't expired
2. **Gmail/Calendar**: Check refresh token is valid
3. **Claude**: Verify Anthropic API key is active

### "Slow responses"

- Check Claude API status at https://status.anthropic.com
- Check Linear API status
- Review Vercel function duration (should be <30 seconds)

### "Database connection errors"

- Verify DATABASE_URL is correct
- Check Neon project is active
- Ensure database tables were created (happens on first call)
- Check connection limits in Neon dashboard

### "Tool calls failing"

1. Check that all API keys are set in Vercel env vars
2. Verify Google refresh token is still valid (tokens can expire)
3. Check Linear API key has correct permissions
4. Review Vercel logs for specific error messages

## Updating the Code

To deploy code changes:

### Using Vercel CLI

```bash
# Make changes locally, test with npm run dev
git add .
git commit -m "Your message"
git push

# Or push directly to Vercel:
vercel --prod --yes
```

### Using Git

Push to your GitHub repo - Vercel will auto-deploy:

```bash
git push origin main
```

## Scaling & Performance

### Connection Pooling

The code uses `pg` client which handles connection pooling. Neon provides up to 100 concurrent connections on free tier.

### API Rate Limits

- **Claude**: 50 RPM (requests per minute) on free tier
- **Linear**: 60 RPM
- **Gmail**: 1,000,000 RPM but watch quotas
- **Google Calendar**: 1,000 RPM

### Optimizations Made

1. Batched tool calls (e.g., check emails AND calendar at once)
2. Conversation history stored in DB (not sent with every request)
3. Caching of integration status (30-second refresh)
4. Minimal database queries with proper indexes

## Security Best Practices

1. **Never commit .env files** - Always use Vercel's environment variables
2. **Rotate tokens regularly** - Especially Google refresh tokens
3. **Use PostgreSQL SSL** - Neon enables this by default in production
4. **Monitor Vercel logs** - Watch for unexpected errors or unusual patterns
5. **Restrict Retell webhook** - Consider adding signature verification
6. **Audit Linear access** - Review which issues the assistant can see/modify

## Disaster Recovery

### Database Backup

Neon provides automated backups. To restore:

1. Go to Neon dashboard
2. Select your project
3. Use point-in-time recovery (PITR)

### Code Rollback

Vercel keeps deployment history:

1. Go to Deployments
2. Click on a previous deployment
3. Click "Promote to Production"

### Manual Recovery

If everything fails:

1. Clone the GitHub repo on a local machine
2. Install dependencies: `npm install`
3. Set environment variables in .env.local
4. Run: `npm run build && npm start`
5. Access via localhost (but won't reach Retell.ai)

## Success Checklist

Before considering deployment complete:

- [ ] Health endpoint returns all integrations as `connected: true`
- [ ] Dashboard shows "Agent Live"
- [ ] Can see recent call logs (even empty is fine for new deployment)
- [ ] Test email check returns results
- [ ] Test calendar check returns events
- [ ] Test Linear issue listing works
- [ ] Test creating an issue in Linear
- [ ] Retell.ai webhook receives POST requests
- [ ] Claude responses are generated and returned to Retell
- [ ] Call metadata is stored in database
- [ ] No errors in Vercel logs

---

**Deployment complete!** Dale can now start using his voice PA.

For daily operations, see `/README.md`.
