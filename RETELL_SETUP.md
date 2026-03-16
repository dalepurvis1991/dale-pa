# Retell.ai Configuration Guide

Complete step-by-step guide to configure Retell.ai for Dale's PA voice agent.

## 1. Create Retell Agent

1. Go to https://retell.ai/dashboard
2. Click "Create Agent"
3. Choose "Custom Agent"

## 2. Basic Configuration

### Agent Name
```
Dale's PA
```

### Agent Description
```
Personal assistant for Dale Purvis - Floor Giants Group. Handles email triage, calendar scheduling, sprint management via voice.
```

## 3. Agent Prompt

Copy the full prompt from `/src/lib/claude.ts` under the `SYSTEM_PROMPT` constant.

Or use this summary:

```
You are Dale Purvis's personal assistant — sharp, efficient, and funny. You're helping the owner of Floor Giants Group (13 legal entities across the UK) and Evergreen Floors Ltd manage his day, capture his thinking, and keep operations moving.

Your core style: Brief and to the point. No waffle. You're a warm but direct operator — think sharp northern mate who happens to know everything about his business.

[Rest of prompt from SYSTEM_PROMPT in claude.ts]
```

## 4. Voice Configuration

### Voice Selection

**Recommended settings for UK Northern tone:**

- **Voice Provider**: ElevenLabs or Google Cloud TTS
- **Language**: English (UK)
- **Accent**: Neutral UK or slight Northern accent
- **Gender**: Male
- **Age**: 35-45 years old (professional but approachable)

**Test phrases:**
- "Alright Dale, right, let me get into it."
- "That's a solid idea but we've already locked in the sprint."
- "Legend. Catch you later."

Listen for warmth, clarity, and conversational tone. Avoid robotic or over-corporate sound.

## 5. Webhook Configuration

### Webhook URL

```
https://your-vercel-domain.vercel.app/api/retell
```

Replace `your-vercel-domain` with your actual Vercel deployment URL.

### Webhook Events

Enable the following events:

- [x] `call_started` - When user initiates call
- [x] `call_analyzed` - When user speech is transcribed
- [x] `call_ended` - When call ends

## 6. Interruption & Conversation Settings

### Interruption Handling

- **Enable Interruption**: Yes (Dale will want to jump in mid-thought)
- **Interruption Sensitivity**: High (7-8 out of 10)
  - He's busy and will cut off the agent frequently
  - The agent should gracefully resume after interruption

### Barge-In

- **Enable Barge-In**: Yes
- This allows Dale to speak over the agent

### On-Hold Detection

- **Enable**: Yes
- **Silence Timeout**: 10 seconds (detect end of Dale's statement)

## 7. Audio Settings

### Input Audio

- **Sample Rate**: 16 kHz or higher
- **Channels**: Mono
- **Format**: Linear PCM (WAV, FLAC) or OGG Opus

### Output Audio

- **Sample Rate**: 24 kHz
- **Bitrate**: 128 kbps (balanced quality/latency)

### Audio Processing

- **Enable Noise Suppression**: Yes
  - Dale might call from warehouse/office with background noise
- **Enable Echo Cancellation**: Yes
- **Enable Auto Gain Control**: Yes

## 8. Call Duration & Constraints

### Timeouts

- **Inactivity Timeout**: 10 seconds
  - If Dale doesn't respond for 10 seconds, agent offers to end call
- **Max Call Duration**: 45 minutes
  - Morning calls: 10-15 mins
  - Evening calls: 5-10 mins
  - Ad-hoc: varies

### Token/Context Limits

- **Max Response Tokens**: 2000 per turn
  - Keeps agent responses tight and efficient
- **Context Window**: Conversation history maintained in database
- **Function Call Timeout**: 5 seconds
  - Email/Calendar/Linear calls should respond quickly

## 9. End-Call Triggers

Configure when the agent should end the call:

### Auto-End Conditions

- User says: "That's all"
- User says: "Cheers" or "Thanks"
- User says: "All sorted" or "All done"
- User says: "Right, I'm off"
- Silence >10 seconds during evening call (presumed end)
- Call duration >30 minutes

### Manual End

Agent should offer to end call if:
- Dale goes silent for 10 seconds
- Agent has covered all agenda items
- Dale asks "Anything else?" and gets no response

## 10. Function/Tool Configuration

**Important**: The tools are implemented in the code (`src/lib/claude.ts`), not Retell's UI. However, you should understand what each does:

### Available Tools

1. **check_emails** - Search Gmail
   - Example: "What emails came in overnight?"
2. **draft_email** - Create Gmail draft
   - Example: "Draft an email to Zack about the warehouse issue"
3. **check_calendar** - List calendar events
   - Example: "What's on today?"
4. **create_calendar_event** - Schedule meeting
   - Example: "Add a meeting with Brett on Thursday at 10am"
5. **list_linear_issues** - Pull sprint status
   - Example: "What's in progress this sprint?"
6. **create_linear_issue** - Create task
   - Example: "Create a task for the website redesign"
7. **update_linear_issue** - Move work
   - Example: "Mark FLO-47 as done"

All tools execute through the `/api/retell` endpoint. No configuration needed in Retell UI.

## 11. Test Scenarios

Before going live, test these scenarios:

### Morning Call
1. User: "Morning, what have we got?"
   - Expected: Agent pulls emails, calendar, sprint status
2. User: "Add a meeting with Zack Thursday 10am"
   - Expected: Agent confirms, creates event
3. User: "We need to fix the warehouse issue"
   - Expected: Agent offers to create Linear task

### Evening Call
1. User: "Evening, quick debrief"
   - Expected: Agent asks what got done, what didn't
2. User: "Create an email to Brett about next month"
   - Expected: Agent drafts email, confirms send

### Ad-hoc
1. User: "What's the status of FLO-42?"
   - Expected: Agent retrieves issue details
2. User: "Send an email to Oskar"
   - Expected: Agent prompts for details, drafts

## 12. Call Recording & Analysis

### Recording

- **Enable Recording**: Recommended for first 2 weeks
  - Monitor quality and tone
  - Train your understanding of Dale's communication style

### Transcription

- **Keep Transcripts**: Yes (stored in database via `/api/retell`)
- **Analyze Sentiment**: Optional
- **Track Metrics**: Call duration, completion rate, user satisfaction

## 13. Scheduled Calls

Configure daily calls within Retell:

### Morning Call

- **Time**: 7:30 AM daily (Mon-Fri)
- **Type**: Incoming call to Dale
- **Initial Prompt**: "Alright Dale, morning check-in?"

### Evening Call

- **Time**: 6:00 PM daily (Mon-Fri)
- **Type**: Incoming call to Dale
- **Initial Prompt**: "Evening, quick debrief time?"

**Note**: Requires Retell Pro or integration with external scheduler (AWS Lambda, Zapier, etc.)

## 14. Monitoring & Adjustments

### First Week Monitoring

- [ ] Listen to 2-3 calls
- [ ] Check agent tone (warm, efficient, not robotic)
- [ ] Monitor function success rate
- [ ] Track call duration vs. target
- [ ] Note any missing context or misunderstandings

### Tone Adjustments

If agent is too verbose:
- Reduce max tokens in `/src/lib/claude.ts`
- Simplify system prompt

If agent sounds robotic:
- Test different voices
- Add more contractions ("I'm", "that's")
- Test lighter tone in system prompt

If function calls are slow:
- Check API key validity
- Batch calls (do emails + calendar simultaneously)

## 15. Production Checklist

Before declaring "live":

- [ ] Webhook URL configured and tested
- [ ] Agent prompt uploaded
- [ ] Voice selected and tested
- [ ] Interruption handling enabled
- [ ] Audio processing configured
- [ ] End-call triggers set
- [ ] Test scenarios all pass
- [ ] Database initialized and working
- [ ] All API integrations active
- [ ] Health endpoint shows all green
- [ ] First 3 calls monitored by team

## Common Retell.ai Settings

### Quick Config Table

| Setting | Value | Reason |
|---------|-------|--------|
| Interruption Sensitivity | 7-8/10 | Dale is time-poor, wants to interrupt |
| Silence Timeout | 10s | Standard for conversational AI |
| Max Call Duration | 45min | Safety limit, usually won't hit |
| Audio Sample Rate | 16kHz+ | Excellent clarity |
| Echo Cancellation | On | Office/warehouse use |
| Max Response Tokens | 2000 | Keep responses tight |
| Inactivity Timeout | 10s | Detect end of statement |

## Troubleshooting

### Agent Not Responding

1. Check webhook URL is correct and accessible
2. Verify all API keys in Vercel env vars
3. Check Vercel logs for errors
4. Test health endpoint: `https://your-domain/api/health`

### Slow Responses

1. Check Claude API status
2. Verify database isn't hanging
3. Check Linear/Gmail API latency
4. Consider reducing max_tokens in system prompt

### Wrong Tone

1. Review system prompt in `/src/lib/claude.ts`
2. Test voice samples
3. Adjust temperature if available
4. Add/remove contractions from prompt

### Tools Not Working

1. Verify API keys haven't expired
2. Check Linear project key is "FLO"
3. Verify Gmail has correct scopes
4. Test tools individually via health endpoint

## Getting Help

- Retell.ai docs: https://docs.retell.ai
- Check Vercel logs: https://vercel.com/dashboard
- Test health endpoint for integration status

---

**Ready to go live!** See `DEPLOYMENT.md` for final checklist.
