// Pure search / filter / sort / group / paginate helpers for the card browser.
//
// Everything here operates over plain `CardData[]` (typically `db.all()` minus
// the non-playable rarities) and returns new arrays — no mutation, no db state.
// See docs/features/deckbuilder-overhaul.md — "Search & filtering", "Sorting &
// grouping".

import type { CardData } from '@mood-swings/engine';

export type SortKey = 'number' | 'value' | 'rarity' | 'name' | 'color';

export interface Filters {
  /** Empty set = no constraint; otherwise OR within the set. */
  colors: Set<string>;
  rarities: Set<string>;
  /** Die color: white = fixed value, black = variable. Empty = no constraint. */
  dieColors: Set<'white' | 'black'>;
  valueMin: number;
  valueMax: number;
  /** null = no constraint; true/false = require secondary present/absent. */
  hasSecondary: boolean | null;
  /** null = no constraint; true/false = require rules text present/absent. */
  hasRules: boolean | null;
}

/** Fresh filter state that constrains nothing. */
export function emptyFilters(): Filters {
  return {
    colors: new Set(),
    rarities: new Set(),
    dieColors: new Set(),
    valueMin: 0,
    valueMax: 12,
    hasSecondary: null,
    hasRules: null,
  };
}

// Canonical orderings.
const COLOR_ORDER = ['white', 'blue', 'black', 'red', 'green'];
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'mythic'];

function colorRank(color: string): number {
  const i = COLOR_ORDER.indexOf(color);
  return i === -1 ? COLOR_ORDER.length : i;
}

function rarityRank(rarity: string): number {
  const i = RARITY_ORDER.indexOf(rarity);
  return i === -1 ? RARITY_ORDER.length : i;
}

function hasRulesText(card: CardData): boolean {
  return card.rulesText != null && card.rulesText !== '';
}

/**
 * Full-text search + filter chips. Query is a case-insensitive substring over
 * name AND rules text; empty query = no text constraint. An empty set in a
 * filter category means "no constraint"; a populated set is OR-matched. The
 * value range tests the printed primary value.
 */
export function searchAndFilter(pool: CardData[], query: string, f: Filters): CardData[] {
  const q = query.trim().toLowerCase();
  return pool.filter((card) => {
    if (q !== '') {
      const name = card.name.toLowerCase();
      const rules = (card.rulesText ?? '').toLowerCase();
      if (!name.includes(q) && !rules.includes(q)) return false;
    }
    if (f.colors.size > 0 && !f.colors.has(card.color)) return false;
    if (f.rarities.size > 0 && !f.rarities.has(card.rarity)) return false;
    if (f.dieColors.size > 0 && !f.dieColors.has(card.dieColor)) return false;
    if (card.value < f.valueMin || card.value > f.valueMax) return false;
    if (f.hasSecondary !== null && (card.secondaryValue != null) !== f.hasSecondary) return false;
    if (f.hasRules !== null && hasRulesText(card) !== f.hasRules) return false;
    return true;
  });
}

/**
 * Stable sort by the given key/direction. 'number' = box order; 'color' orders
 * white,blue,black,red,green then number; 'name' alphabetical; 'value' by
 * primary value; 'rarity' common<uncommon<rare<mythic. Ties break by collector
 * number so the order is deterministic; `dir` reverses the comparison.
 */
export function sortCards(cards: CardData[], key: SortKey, dir: 'asc' | 'desc'): CardData[] {
  const sign = dir === 'desc' ? -1 : 1;
  // Decorate with the original index so equal elements keep their input order
  // regardless of the underlying sort's stability guarantees.
  const decorated = cards.map((card, index) => ({ card, index }));
  decorated.sort((a, b) => {
    const primary = compareByKey(a.card, b.card, key);
    if (primary !== 0) return primary * sign;
    return a.index - b.index;
  });
  return decorated.map((d) => d.card);
}

function compareByKey(a: CardData, b: CardData, key: SortKey): number {
  switch (key) {
    case 'number':
      return a.number - b.number;
    case 'value':
      return a.value - b.value || a.number - b.number;
    case 'rarity':
      return rarityRank(a.rarity) - rarityRank(b.rarity) || a.number - b.number;
    case 'name':
      return a.name.localeCompare(b.name) || a.number - b.number;
    case 'color':
      return colorRank(a.color) - colorRank(b.color) || a.number - b.number;
    default:
      return a.number - b.number;
  }
}

export interface CardGroup {
  label: string;
  count: number;
  cards: CardData[];
}

/**
 * Split cards into labeled sections following the active sort key, preserving
 * the incoming order within each group and emitting groups in the key's
 * canonical section order. Only non-empty groups are returned.
 */
export function groupBySort(cards: CardData[], key: SortKey): CardGroup[] {
  if (key === 'number') {
    return cards.length ? [{ label: 'All', count: cards.length, cards: [...cards] }] : [];
  }

  const buckets = new Map<string, CardData[]>();
  const push = (bucketKey: string, card: CardData) => {
    const arr = buckets.get(bucketKey);
    if (arr) arr.push(card);
    else buckets.set(bucketKey, [card]);
  };

  for (const card of cards) push(bucketKeyFor(card, key), card);

  const orderedKeys = orderedBucketKeys(key, buckets);
  const groups: CardGroup[] = [];
  for (const bk of orderedKeys) {
    const arr = buckets.get(bk);
    if (arr && arr.length) groups.push({ label: labelFor(key, bk), count: arr.length, cards: arr });
  }
  return groups;
}

function bucketKeyFor(card: CardData, key: SortKey): string {
  switch (key) {
    case 'color':
      return card.color;
    case 'rarity':
      return card.rarity;
    case 'value':
      return String(card.value);
    case 'name':
      return firstLetter(card.name);
    default:
      return 'All';
  }
}

function firstLetter(name: string): string {
  const ch = name.trim().charAt(0).toUpperCase();
  return ch === '' ? '#' : ch;
}

function orderedBucketKeys(key: SortKey, buckets: Map<string, CardData[]>): string[] {
  switch (key) {
    case 'color':
      return COLOR_ORDER.filter((c) => buckets.has(c));
    case 'rarity':
      return RARITY_ORDER.filter((r) => buckets.has(r));
    case 'value': {
      const keys: string[] = [];
      for (let v = 0; v <= 12; v++) if (buckets.has(String(v))) keys.push(String(v));
      return keys;
    }
    case 'name':
      return [...buckets.keys()].sort((a, b) => a.localeCompare(b));
    default:
      return [...buckets.keys()];
  }
}

function labelFor(key: SortKey, bucketKey: string): string {
  switch (key) {
    case 'color':
    case 'rarity':
      return bucketKey.charAt(0).toUpperCase() + bucketKey.slice(1);
    case 'value':
      return `Value ${bucketKey}`;
    case 'name':
      return bucketKey;
    default:
      return bucketKey;
  }
}

/**
 * Slice `items` into a page. `pages` = max(1, ceil(len/pageSize)); the requested
 * page is clamped to [1, pages]. An empty list yields one empty page.
 */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): { page: number; pages: number; slice: T[] } {
  const size = Math.max(1, Math.floor(pageSize));
  const pages = Math.max(1, Math.ceil(items.length / size));
  const clamped = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const start = (clamped - 1) * size;
  return { page: clamped, pages, slice: items.slice(start, start + size) };
}
