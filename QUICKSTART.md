# Quick Start - Get Dale's PA Running in 10 Minutes

For the developer deploying this project. Complete setup walkthrough.

## Prerequisites (5 mins)

Gather these before starting:

1. **Anthropic API Key**
   - Go to https://console.anthropic.com
   - Create key (free tier available)
   - Copy: `sk-ant-...`

2. **Linear API Key**
   - Go to https://linear.app/settings/api
   - Create personal API key
   - Copy key

3. **Google OAuth Credentials**
   - Go to https://console.cloud.google.com
   - Create project
   - Enable Gmail API + Calendar API
   - Create OAuth 2.0 client (Web app)
   - Add redirect: `http://localhost:3000/api/auth/callback`
   - Copy Client ID and Secret

4. **Google Refresh Token**
   - Use OAuth 2.0 Playground: https://developers.google.com/oauthplayground
   - Select Gmail and Calendar scopes
   - Authorize and get refresh token
   - Copy refresh token

5. **Neon PostgreSQL**
   - Go to https://neon.tech
   - Create project
   - Create database
   - Copy connection string: `postgresql://...`

6. **Retell.ai Account**
   - Go to https://retell.ai
   - Create account
   - Copy API key (you'll need it later)

7. **GitHub + Vercel** (for deployment)
   - GitHub account with a repo
   - Vercel account (free)

## Setup (5 mins)

### 1. Clone and Install

```bash
cd dale-pa
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your keys:

```
ANTHROPIC_API_KEY=sk-ant-xxxxx
LINEAR_API_KEY=lin_xxxxx
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx
GOOGLE_REFRESH_TOKEN=1//xxxxx
DATABASE_URL=postgresql://user:pass@host/db
RETELL_API_KEY=xxxxx
NODE_ENV=development
```

### 3. Test Locally

```bash
npm run dev
```

Visit http://localhost:3000

You should see:
- Dashboard loads
- Health check shows integrations (may show "degraded" if not all env vars set)
- No errors in console

### 4. Test Webhook

Test the Retell webhook locally:

```bash
curl -X POST http://localhost:3000/api/retell \
  -H "Content-Type: application/json" \
  -d '{
    "event": "call_analyzed",
    "call_id": "test-1",
    "response_id": "resp-123",
    "user_message": "What emails do I have?"
  }'
```

You should get back a JSON response with Claude's reply.

### 5. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod --yes
```

### 6. Add Environment Variables to Vercel

Go to your Vercel project:

1. Settings → Environment Variables
2. Add each variable from `.env.local`
3. Mark `DATABASE_URL` and `GOOGLE_REFRESH_TOKEN` as "Sensitive"

### 7. Configure Retell.ai

1. Go to https://retell.ai/dashboard
2. Create or edit agent
3. Set webhook URL to:
   ```
   https://your-vercel-domain.vercel.app/api/retell
   ```
4. Select voice (British male, neutral UK)
5. Enable interruption handling
6. Test a call

## Verify Everything Works (optional - 2 mins)

### Check Health Endpoint

```bash
curl https://your-domain.vercel.app/api/health
```

Should show:
```json
{
  "status": "ok",
  "integrations": {
    "linear": { "connected": true },
    "gmail": { "connected": true },
    "calendar": { "connected": true }
  }
}
```

### Test Dashboard

Visit your Vercel deployment - should show:
- "Agent Live" status
- Integration status cards
- Recent calls (empty is fine)

### Manual Webhook Test

```bash
curl -X POST https://your-domain.vercel.app/api/retell \
  -H "Content-Type: application/json" \
  -d '{
    "event": "call_analyzed",
    "call_id": "manual-test",
    "response_id": "resp-123",
    "user_message": "Good morning, what is on my calendar today?"
  }'
```

Should return Claude's response about the calendar.

## Common Issues

### "database tables not found"
- PostgreSQL is auto-initialized on first API call
- Run the health check or make a test webhook call
- Tables should appear in Neon dashboard

### "integrations showing degraded"
- Missing or invalid API keys
- Double-check .env variables in Vercel
- Test each API key individually:
  - Linear: Make a test API call
  - Gmail: Check refresh token is valid
  - Calendar: Same as Gmail

### "webhook returns error"
- Check Vercel logs: `vercel logs --tail`
- Verify DATABASE_URL is set
- Verify ANTHROPIC_API_KEY is set
- Check Claude API status at status.anthropic.com

### "Google refresh token expired"
- Get a new one using OAuth 2.0 Playground
- Update DATABASE_URL in Vercel
- Test again

## Next Steps

Once deployed:

1. **Test a Live Call** (if you have Retell.ai configured)
   - Call the number
   - Agent should answer with PA greeting
   - Try asking about emails, calendar, or Linear issues

2. **Monitor First Week**
   - Listen to 3-4 calls
   - Check Vercel logs for any errors
   - Verify all tool calls are working

3. **Adjust Tone** (if needed)
   - Edit system prompt in `src/lib/claude.ts`
   - Redeploy to Vercel
   - Test again

4. **Configure Scheduling**
   - Set up 7:30am and 6pm daily calls in Retell.ai
   - Or use external scheduler (AWS Lambda, Zapier)

## File Reference

Key files you might need to edit:

- **System Prompt**: `src/lib/claude.ts` (line 17-60)
- **Dashboard**: `src/app/page.tsx`
- **Styling**: `src/app/globals.css` and `tailwind.config.ts`
- **Database**: `src/lib/db.ts`
- **Tools**: `src/lib/tools/` folder

## Support Resources

- **Full Deployment Guide**: See `DEPLOYMENT.md`
- **Retell Configuration**: See `RETELL_SETUP.md`
- **Project Overview**: See `PROJECT_SUMMARY.md`
- **General Info**: See `README.md`

## Troubleshooting Docs

For detailed troubleshooting:

1. Check `DEPLOYMENT.md` troubleshooting section
2. Check `RETELL_SETUP.md` troubleshooting section
3. Review Vercel logs: `vercel logs --tail`
4. Check PostgreSQL: Neon dashboard

## Final Checklist

Before considering "deployed":

- [ ] npm install completes without errors
- [ ] `npm run dev` starts without errors
- [ ] http://localhost:3000 loads
- [ ] Health endpoint returns `status: "ok"`
- [ ] Vercel deployment succeeds
- [ ] Environment variables set in Vercel
- [ ] Retell webhook URL configured
- [ ] Test webhook call returns response
- [ ] Dashboard shows "Agent Live"

## You're Done!

The agent is now live and ready for Dale to use.

- **Morning calls**: 7:30 AM (if scheduled)
- **Evening calls**: 6 PM (if scheduled)
- **Ad-hoc calls**: Anytime (if Retell allows)

Enjoy!

---

**Questions?** See the full docs in `DEPLOYMENT.md` and `RETELL_SETUP.md`
