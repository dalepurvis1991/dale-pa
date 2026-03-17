# Dale's PA — Technical Context & Status

> This file tracks technical architecture and project status. Updated by Claude (Cowork).
> For PA identity → SOUL.md | For voice guide → STYLE.md | For session memory → MEMORY.md | For project instructions → CLAUDE.md
> Last updated: 2026-03-17

---

## Soul Framework Files (added 2026-03-17)

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project instructions — read first every session |
| `SOUL.md` | PA identity, worldview, business context, key people |
| `STYLE.md` | Voice & communication patterns, anti-patterns, examples |
| `MEMORY.md` | Persistent memory log — read for context, append after sessions |
| `CONTEXT.md` | Technical architecture & status (this file) |

---

## Project Status

| Area | Status | Notes |
|------|--------|-------|
| Core app (Next.js 14) | Built | 3 commits, not yet deployed |
| Retell webhook | Built | call_started / call_ended / call_analyzed |
| Claude orchestration | Built | Sonnet 4, tool-use loop |
| Linear tools | Built | list / create / update issues |
| Gmail tools | Scaffolded | Needs googleapis + Google OAuth |
| Calendar tools | Scaffolded | Needs googleapis + Google OAuth |
| Memory system | Built (2026-03-17) | Postgres-backed, auto-extracts from calls |
| Vercel project | Linked | `dale-pa` on Vercel, not yet deployed |
| GitHub repo | Exists | `dalepurvis1991/dale-pa` |
| Environment vars | NOT SET | Need to configure in Vercel |

## Architecture

- **Framework:** Next.js 14 + TypeScript
- **Voice:** Retell.ai (webhook-based)
- **AI:** Claude Sonnet 4 via Anthropic SDK
- **Database:** PostgreSQL (Neon)
- **Hosting:** Vercel
- **Tools:** Linear SDK, googleapis (Gmail + Calendar)

## Database Schema

### Existing Tables
- `call_records` — one row per call (call_id, type, duration, summary)
- `conversation_messages` — per-message log (call_id, role, content)

### Memory Tables (added 2026-03-17)
- `call_summaries` — structured post-call summary (decisions, action items, topics, mood)
- `memory_entries` — granular facts/decisions/preferences extracted from calls
  - Categories: decision, task, idea, person, preference, context, followup
  - Importance: 1-5 scale
  - Optional expiry for time-bound items
  - GIN index on tags for fast search

## Memory System Flow

1. **Before each conversation turn:** `buildMemoryContext()` loads recent call summaries + high-importance memories + open follow-ups → injected into system prompt
2. **At call_ended:** `generateCallSummary()` sends the full transcript to Claude with an extraction prompt → saves structured summary + individual memory entries
3. **Background:** expired memories are cleaned up periodically

## Deployment Blockers

1. Environment variables not set in Vercel:
   - `ANTHROPIC_API_KEY`
   - `DATABASE_URL` (Neon)
   - `LINEAR_API_KEY`
   - `RETELL_API_KEY`
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` (for Gmail/Calendar)
2. Google OAuth refresh token not yet generated
3. Retell.ai webhook URL needs configuring post-deploy
4. No test call completed yet

## Key Decisions

- Memory option 1 (Postgres summaries) chosen over vector DB — simpler, ships faster, 80% of value
- Gmail/Calendar tools commented out until OAuth configured — Linear-only for MVP
- `googleapis` restored to package.json (was removed in commit 2)
- Non-blocking memory extraction — call flow never waits on memory saves

## What's Next

- [ ] Deploy to Vercel (push + set env vars)
- [ ] Generate Google OAuth refresh token
- [ ] Uncomment Gmail/Calendar tools in claude.ts once OAuth ready
- [ ] First test call via Retell
- [ ] Add memory dashboard page (view/search memories from the web UI)
- [ ] Consider vector search upgrade later if recall needs grow

## People & Contacts (for PA context)

| Name | Role | Notes |
|------|------|-------|
| Zack Husain | Operations | Escalates warehouse/supply issues |
| Oskar Dabski-Baker | Evergreen marketing | |
| Phil Isherwood | DMP SEO | |
| Brett Janes | Salience MD | £12k/month retainer |

## Branch / Entity Reference

FG Derby, FG Nottingham, FG Hull, FG Doncaster, FG Basildon, FG Hedge End, FG CD1, FG CD2, FG Merthyr, FG Swansea, FG Online, Evergreen Floors Ltd
