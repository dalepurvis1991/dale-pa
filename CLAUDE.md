# CLAUDE.md — Project Instructions for AI Assistants

> Read this file every session. It tells you what this project is, how it works, and how to work on it.

---

## Project Overview

**dale-pa** is a voice-first personal assistant for Dale Purvis, built on Retell.ai + Claude Sonnet 4 + Next.js 14. It manages Dale's daily operations across Floor Giants Group (13 UK flooring retail entities) and Evergreen Floors Ltd (wholesale).

**Owner:** Dale Purvis (dalepurvis@floorgiants.co.uk)
**Repo:** github.com/dalepurvis1991/dale-pa
**Hosting:** Vercel (project: dale-pa)
**Database:** PostgreSQL on Neon

---

## File Hierarchy — Read Order

```
dale-pa/
├── CLAUDE.md          ← You are here. Project instructions.
├── SOUL.md            ← PA identity, worldview, business context. Read this.
├── STYLE.md           ← Voice & communication patterns. Read this.
├── MEMORY.md          ← Persistent memory log. Read for context, append after sessions.
├── CONTEXT.md         ← Technical project status & architecture reference.
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── retell/route.ts   ← Retell webhook (call_started/ended/analyzed)
│   │   │   └── health/route.ts   ← Health check endpoint
│   │   ├── page.tsx              ← Dashboard UI
│   │   ├── layout.tsx
│   │   └── globals.css
│   └── lib/
│       ├── claude.ts             ← Claude orchestration + memory extraction
│       ├── db.ts                 ← Database layer (call_records, messages)
│       ├── memory.ts             ← Memory system (summaries, entries, context builder)
│       └── tools/
│           ├── linear.ts         ← Linear SDK integration
│           ├── gmail.ts          ← Gmail tools (needs Google OAuth)
│           └── calendar.ts       ← Calendar tools (needs Google OAuth)
├── package.json
├── next.config.js
├── tsconfig.json
├── tailwind.config.ts
└── postcss.config.js
```

---

## Architecture

### Voice Call Flow
1. **Retell.ai** receives voice → transcribes → sends webhook to `/api/retell`
2. **call_started**: Create call record, detect call type (morning/evening/adhoc), return greeting
3. **call_analyzed**: Save user message → load conversation history → load memory context → call Claude with tools → return response
4. **call_ended**: Calculate duration → fire background memory extraction → cleanup expired memories

### Memory System
- **Before each turn:** `buildMemoryContext()` loads recent call summaries + high-importance memories + open follow-ups → injected into system prompt
- **At call end:** `generateCallSummary()` sends full transcript to Claude extraction prompt → saves structured summary + granular memory entries
- **Categories:** decision, task, idea, person, preference, context, followup
- **Importance:** 1-5 scale (5 = always surface)
- **Expiry:** Optional, for time-bound items

### Database Tables
- `call_records` — one per call (type, duration, summary)
- `conversation_messages` — per-message log
- `call_summaries` — structured post-call summary (decisions, action items, topics, mood)
- `memory_entries` — granular extracted facts (category, importance, tags, optional expiry)

---

## Code Conventions

### DO:
- **Incremental, modular changes** — this codebase is a living project. Design to extend, not replace
- **Type everything** — TypeScript strict mode is on
- **Handle errors gracefully** — memory failures should never break the call flow
- **Use the existing patterns** — Pool-based Postgres, tool-use loop in claude.ts
- **Keep tools self-contained** — each file in tools/ is independent
- **Background non-critical work** — memory extraction is fire-and-forget
- **Update CONTEXT.md** when making architectural changes
- **Update MEMORY.md** when notable decisions or changes are made

### DON'T:
- Replace files wholesale — edit incrementally
- Add new SaaS dependencies without discussing with Dale
- Commit API keys or .env files
- Break the Retell webhook contract — it's a live integration
- Assume the schema is fixed — new fields/tables will be added continuously
- Use corporate jargon in user-facing text (read STYLE.md)

### Stack:
- Next.js 14 + TypeScript
- Tailwind CSS
- PostgreSQL (Neon) via `pg`
- Anthropic SDK (`@anthropic-ai/sdk`)
- Linear SDK (`@linear/sdk`)
- googleapis (Gmail + Calendar — currently disabled pending OAuth)

---

## Environment Variables

```
ANTHROPIC_API_KEY=       # Claude API key
DATABASE_URL=            # Neon Postgres connection string
LINEAR_API_KEY=          # Linear API key for Floor Giants workspace
RETELL_API_KEY=          # Retell.ai API key
GOOGLE_CLIENT_ID=        # Google OAuth (for Gmail/Calendar)
GOOGLE_CLIENT_SECRET=    # Google OAuth
GOOGLE_REFRESH_TOKEN=    # Google OAuth refresh token
```

---

## Current Status & Blockers

- Core app: Built, not deployed
- Memory system: Built (2026-03-17)
- Gmail/Calendar: Scaffolded but disabled (needs Google OAuth)
- Deployment: Vercel project linked, env vars not set
- First test call: Not done yet

See CONTEXT.md for the full checklist.

---

## Working on This Project

1. **Read SOUL.md and STYLE.md first** — understand the PA's personality
2. **Check MEMORY.md** — see what's happened recently
3. **Check CONTEXT.md** — see technical status and blockers
4. **Make changes incrementally** — small PRs, clear descriptions
5. **Test locally before pushing** — `npm run dev`, check TypeScript with `npx tsc --noEmit`
6. **Update CONTEXT.md** after significant changes
7. **Log decisions to MEMORY.md** if they affect the project direction
