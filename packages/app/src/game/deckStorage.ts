// localStorage-backed saved decks + view-mode preference for the deckbuilder.
//
// Every localStorage access is wrapped in try/catch: storage can be absent
// (SSR/tests), disabled (private mode), full, or hold corrupt JSON, and none of
// those should ever throw out of the builder. See
// docs/features/deckbuilder-overhaul.md — "Persistence — saved decks".

import type { DeckCounts } from './deckModel.js';
import { db } from './db.js';

export interface SavedDeck {
  id: string;
  name: string;
  /** Collector number (as a string key) -> copies. */
  cards: Record<string, number>;
  updatedAt: number;
}

const DECKS_KEY = 'moodswings.decks.v1';
const VIEW_KEY = 'moodswings.builder.view';

type DeckMap = Record<string, SavedDeck>;

// --- low-level storage (all failures degrade to null / no-op) ---------------

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function readMap(): DeckMap {
  const s = storage();
  if (!s) return {};
  try {
    const raw = s.getItem(DECKS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as DeckMap;
  } catch {
    return {};
  }
}

function writeMap(map: DeckMap): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(DECKS_KEY, JSON.stringify(map));
  } catch {
    /* quota exceeded or storage disabled — nothing we can do */
  }
}

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `deck-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function countsToRecord(d: DeckCounts): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [n, count] of d) if (count > 0) out[String(n)] = count;
  return out;
}

// --- public API -------------------------------------------------------------

/** All saved decks, newest first. Empty if none or storage unavailable. */
export function listDecks(): SavedDeck[] {
  return Object.values(readMap()).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Create (new id) or update (given id) a saved deck; bumps `updatedAt`. */
export function saveDeck(name: string, d: DeckCounts, id?: string): SavedDeck {
  const map = readMap();
  const deckId = id ?? newId();
  const saved: SavedDeck = {
    id: deckId,
    name,
    cards: countsToRecord(d),
    updatedAt: Date.now(),
  };
  map[deckId] = saved;
  writeMap(map);
  return saved;
}

export function deleteDeck(id: string): void {
  const map = readMap();
  if (id in map) {
    delete map[id];
    writeMap(map);
  }
}

export function renameDeck(id: string, name: string): void {
  const map = readMap();
  const existing = map[id];
  if (!existing) return;
  map[id] = { ...existing, name, updatedAt: Date.now() };
  writeMap(map);
}

/** Copy a saved deck under a new id and a "(copy)" name. Null if not found. */
export function duplicateDeck(id: string): SavedDeck | null {
  const map = readMap();
  const existing = map[id];
  if (!existing) return null;
  const copy: SavedDeck = {
    id: newId(),
    name: `${existing.name} (copy)`,
    cards: { ...existing.cards },
    updatedAt: Date.now(),
  };
  map[copy.id] = copy;
  writeMap(map);
  return copy;
}

/**
 * Rebuild a count map from a saved deck. Card numbers no longer in the db are
 * dropped and reported in `dropped` so the UI can surface a notice.
 */
export function loadDeckCounts(sd: SavedDeck): { counts: DeckCounts; dropped: number[] } {
  const counts: DeckCounts = new Map();
  const dropped: number[] = [];
  for (const [key, count] of Object.entries(sd.cards)) {
    const n = Number(key);
    if (!Number.isFinite(n) || !Number.isFinite(count) || count <= 0) continue;
    if (db.has(n)) counts.set(n, Math.floor(count));
    else dropped.push(n);
  }
  return { counts, dropped };
}

/** The persisted view-mode preference, or null if unset/unavailable. */
export function getViewPref(): string | null {
  const s = storage();
  if (!s) return null;
  try {
    return s.getItem(VIEW_KEY);
  } catch {
    return null;
  }
}

export function setViewPref(v: string): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(VIEW_KEY, v);
  } catch {
    /* storage disabled/full — preference simply won't persist */
  }
}
