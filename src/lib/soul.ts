import { readFile } from 'fs/promises';
import { join } from 'path';

// ── Soul Loader ──────────────────────────────────────────────────────────
// Loads SOUL.md and STYLE.md from the project root and builds the system
// prompt dynamically. This means personality changes only require editing
// markdown files — no code changes needed.

let cachedPrompt: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // Re-read files every 5 minutes

const PROJECT_ROOT = process.cwd();

// Fallback if files can't be loaded (e.g., first deploy before files exist)
const FALLBACK_PROMPT = `You are Dale Purvis's personal assistant — sharp, efficient, and funny. You're helping the owner of Floor Giants Group (13 legal entities across the UK) and Evergreen Floors Ltd manage his day, capture his thinking, and keep operations moving.

Your core style: Brief and to the point. No waffle. You're a warm but direct operator — think sharp northern mate who happens to know everything about his business.

Starting a MORNING CALL: "Alright Dale, right, let me get into it."
Starting an EVENING CALL: "Evening. Quick debrief."
Starting an AD-HOC CALL: "Quick one — what do you need?"`;

async function loadFile(filename: string): Promise<string | null> {
  try {
    const filePath = join(PROJECT_ROOT, filename);
    const content = await readFile(filePath, 'utf-8');
    return content;
  } catch {
    console.warn(`Soul loader: ${filename} not found, skipping`);
    return null;
  }
}

function buildSystemPrompt(soul: string | null, style: string | null): string {
  if (!soul && !style) {
    return FALLBACK_PROMPT;
  }

  const sections: string[] = [];

  sections.push('You are Dale Purvis\'s personal assistant. Read and embody the identity and voice defined below.\n');

  if (soul) {
    sections.push('--- IDENTITY & CONTEXT (from SOUL.md) ---');
    sections.push(soul);
    sections.push('--- END IDENTITY ---\n');
  }

  if (style) {
    sections.push('--- VOICE & STYLE (from STYLE.md) ---');
    sections.push(style);
    sections.push('--- END VOICE & STYLE ---\n');
  }

  // Operating instructions that sit on top of the soul/style
  sections.push(`--- OPERATING INSTRUCTIONS ---
You ARE this PA for the duration of every interaction. Never break character.
- Never say "as an AI" or "I don't have opinions"
- If uncertain, express it in-character: "I haven't checked that yet, give me a sec"
- Extrapolate from the worldview and opinions in SOUL.md when asked about new topics
- Match the voice patterns in STYLE.md exactly — sentence length, vocabulary, anti-patterns
- When making tool calls, don't narrate — just do it and report results
- Keep responses concise. Dale values his time
--- END OPERATING INSTRUCTIONS ---`);

  return sections.join('\n');
}

/**
 * Get the system prompt, built from SOUL.md and STYLE.md.
 * Caches for 5 minutes to avoid reading files on every request.
 * Falls back to a hardcoded prompt if files are missing.
 */
export async function getSystemPrompt(): Promise<string> {
  const now = Date.now();

  if (cachedPrompt && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedPrompt;
  }

  const [soul, style] = await Promise.all([
    loadFile('SOUL.md'),
    loadFile('STYLE.md'),
  ]);

  cachedPrompt = buildSystemPrompt(soul, style);
  cacheTimestamp = now;

  console.log(
    `Soul loaded: SOUL.md ${soul ? '✓' : '✗'}, STYLE.md ${style ? '✓' : '✗'} (${cachedPrompt.length} chars)`
  );

  return cachedPrompt;
}

/** Force reload on next call (useful after file edits) */
export function invalidateSoulCache(): void {
  cachedPrompt = null;
  cacheTimestamp = 0;
}
