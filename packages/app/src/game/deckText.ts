// Plain-text deck import/export (MTG-style decklist). Pure functions — no db
// mutation, no I/O. See docs/features/deckbuilder-overhaul.md — "Import /
// export — plain-text list".

import type { CardDB } from '@mood-swings/engine';
import type { DeckCounts } from './deckModel.js';

/**
 * Serialize a deck to text: one `N Cardname` line per card ascending by
 * collector number. When `name` is given, a `# <name> — <total> cards` header
 * comment is prepended.
 */
export function serializeDeck(d: DeckCounts, db: CardDB, name?: string): string {
  const lines: string[] = [];
  if (name !== undefined) {
    let total = 0;
    for (const count of d.values()) total += count;
    lines.push(`# ${name} — ${total} cards`);
  }
  for (const n of [...d.keys()].sort((a, b) => a - b)) {
    const count = d.get(n) ?? 0;
    if (count <= 0) continue;
    const cardName = db.has(n) ? db.get(n).name : `#${n}`;
    lines.push(`${count} ${cardName}`);
  }
  return lines.join('\n');
}

// `3 Name`, `3x Name`, `3X Name`, or bare `Name` (count defaults to 1).
const LINE_RE = /^\s*(?:(\d+)\s*[xX]?\s+)?(.+?)\s*$/;

/**
 * Parse a decklist. Blank lines and `#` comment lines are ignored. Each card
 * line is an optional integer count (`3`, `3x`, `3X`) then a card name matched
 * case-insensitively (trimmed) against db names. Missing count = 1; repeated
 * names sum. Lines whose name doesn't resolve are returned (raw) in `unmatched`.
 */
export function parseDeck(text: string, db: CardDB): { counts: DeckCounts; unmatched: string[] } {
  const byName = buildNameIndex(db);
  const counts: DeckCounts = new Map();
  const unmatched: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const m = LINE_RE.exec(rawLine);
    if (!m) {
      unmatched.push(rawLine);
      continue;
    }
    const count = m[1] === undefined ? 1 : Number.parseInt(m[1], 10);
    const name = (m[2] ?? '').trim();
    const number = byName.get(name.toLowerCase());
    if (number === undefined || !Number.isFinite(count) || count <= 0) {
      unmatched.push(rawLine);
      continue;
    }
    counts.set(number, (counts.get(number) ?? 0) + count);
  }

  return { counts, unmatched };
}

function buildNameIndex(db: CardDB): Map<string, number> {
  // Import builds a *playable* deck, so resolve names within the playable pool.
  // This disambiguates the two "Love" entries — #127 (pool mythic) vs #134
  // (filtered headliner foil) — to the playable card. First (lowest-numbered)
  // playable card wins for any name collision.
  const byName = new Map<string, number>();
  for (const card of db.all()) {
    if (card.rarity === 'headliner' || card.rarity === 'helper') continue;
    const key = card.name.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, card.number);
  }
  return byName;
}
