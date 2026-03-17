# Memory

> Persistent memory log for Dale's PA project. Updated by Claude (Cowork) and the PA agent.
> Read this at the start of every session. Append notable events, decisions, and context.

---

## Log

- **2026-03-17**: Project reviewed in Cowork session. Memory system built — Postgres-backed with call_summaries and memory_entries tables. Memory context auto-injected into system prompt before each call. Post-call extraction generates structured summaries with decisions, tasks, ideas, people notes, follow-ups. Non-blocking design so memory failures never break call flow.

- **2026-03-17**: googleapis restored to package.json (was removed in earlier commit, breaking Gmail/Calendar tools). Gmail and Calendar tools still disabled pending Google OAuth setup.

- **2026-03-17**: tsconfig.json fixed — updated to proper Next.js 14 config with moduleResolution: "bundler" and jsx: "preserve". Previous config had incompatible settings.

- **2026-03-17**: SOUL.md, STYLE.md, CLAUDE.md, and MEMORY.md created following the soul.md framework (aaronjmars/soul.md) and OpenClaw patterns. These define the PA's identity, voice, project instructions, and persistent memory.

- **2026-03-17**: Decision — start with Postgres summaries for memory (option 1) over vector DB. Simpler, ships faster, 80% of value. Can add vector search later if recall needs grow.

- **2026-03-17**: Decision — memory extraction is fire-and-forget (background, non-blocking). If it fails, the call still works fine. Defensive design.

---

## Key Preferences (Dale)

- Concise, action-oriented responses — not lengthy explanations
- Incremental, modular code changes — design to extend, not replace
- Invoices/financial docs → accounts@floorgiants.co.uk always
- Staff requests tracked in Linear under Floor Giants team
- Sprint cadence: 2-week (Week 1: Build, Week 2: Test & Adjust)

---

- **2026-03-17**: Scheduled task `dale-pa-context-check` created — runs 7:30am weekday mornings. Reads MEMORY.md, CONTEXT.md, SOUL.md and recent git log, then gives Dale a status briefing. Lives in Claude Scheduled Tasks.

---

## Open Items

- [ ] Deploy to Vercel (push + set env vars)
- [ ] Generate Google OAuth refresh token for Gmail/Calendar
- [ ] Uncomment Gmail/Calendar tools in claude.ts once OAuth ready
- [ ] First test call via Retell
- [ ] Add memory dashboard page (view/search memories from web UI)
- [ ] Consider vector search upgrade if recall needs grow
