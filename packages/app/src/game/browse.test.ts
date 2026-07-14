import { describe, expect, it } from 'vitest';
import type { CardData } from '@mood-swings/engine';
import { db } from './db.js';
import {
  emptyFilters,
  groupBySort,
  paginate,
  searchAndFilter,
  sortCards,
  type SortKey,
} from './browse.js';

const POOL: CardData[] = db
  .all()
  .filter((c) => c.rarity !== 'headliner' && c.rarity !== 'helper');

describe('browse — pool sanity', () => {
  it('the playable pool is 133 cards', () => {
    expect(POOL.length).toBe(133);
  });
});

describe('browse — searchAndFilter', () => {
  it('empty query + empty filters returns the whole pool', () => {
    expect(searchAndFilter(POOL, '', emptyFilters()).length).toBe(POOL.length);
  });

  it('query matches name OR rules text, case-insensitively', () => {
    const res = searchAndFilter(POOL, 'discard', emptyFilters());
    expect(res.length).toBeGreaterThan(0);
    for (const c of res) {
      const hit =
        c.name.toLowerCase().includes('discard') ||
        (c.rulesText ?? '').toLowerCase().includes('discard');
      expect(hit).toBe(true);
    }
    // at least some hits are rules-text only (name doesn't contain "discard")
    expect(res.some((c) => !c.name.toLowerCase().includes('discard'))).toBe(true);
  });

  it('color chip = OR within category, AND across categories', () => {
    const f = emptyFilters();
    f.colors.add('red');
    f.rarities.add('common');
    const res = searchAndFilter(POOL, '', f);
    expect(res.length).toBeGreaterThan(0);
    for (const c of res) {
      expect(c.color).toBe('red');
      expect(c.rarity).toBe('common');
    }
  });

  it('value range tests the printed primary value', () => {
    const f = emptyFilters();
    f.valueMin = 5;
    f.valueMax = 7;
    const res = searchAndFilter(POOL, '', f);
    expect(res.length).toBeGreaterThan(0);
    for (const c of res) expect(c.value).toBeGreaterThanOrEqual(5);
    for (const c of res) expect(c.value).toBeLessThanOrEqual(7);
  });

  it('hasSecondary and hasRules booleans constrain presence', () => {
    const withSecondary = { ...emptyFilters(), hasSecondary: true };
    for (const c of searchAndFilter(POOL, '', withSecondary)) {
      expect(c.secondaryValue).not.toBeNull();
    }
    const noRules = { ...emptyFilters(), hasRules: false };
    for (const c of searchAndFilter(POOL, '', noRules)) {
      expect(c.rulesText == null || c.rulesText === '').toBe(true);
    }
  });

  it('dieColor chip tests card.dieColor', () => {
    const f = emptyFilters();
    f.dieColors.add('black');
    const res = searchAndFilter(POOL, '', f);
    for (const c of res) expect(c.dieColor).toBe('black');
  });
});

describe('browse — sortCards', () => {
  it('number sort is ascending box order', () => {
    const sorted = sortCards(POOL, 'number', 'asc');
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.number).toBeGreaterThan(sorted[i - 1]!.number);
    }
  });

  it('rarity sort orders common<uncommon<rare<mythic', () => {
    const rank = { common: 0, uncommon: 1, rare: 2, mythic: 3 } as Record<string, number>;
    const sorted = sortCards(POOL, 'rarity', 'asc');
    for (let i = 1; i < sorted.length; i++) {
      expect(rank[sorted[i]!.rarity]!).toBeGreaterThanOrEqual(rank[sorted[i - 1]!.rarity]!);
    }
  });

  it('desc reverses the ordering', () => {
    const asc = sortCards(POOL, 'value', 'asc');
    const desc = sortCards(POOL, 'value', 'desc');
    expect(desc[0]!.value).toBe(asc[asc.length - 1]!.value);
  });

  it('is stable / non-mutating', () => {
    const copy = [...POOL];
    sortCards(POOL, 'color', 'asc');
    expect(POOL).toEqual(copy); // input untouched
  });
});

describe('browse — groupBySort', () => {
  it('color grouping yields present color sections in canonical order', () => {
    const groups = groupBySort(sortCards(POOL, 'color', 'asc'), 'color');
    expect(groups.map((g) => g.label)).toEqual(['White', 'Blue', 'Black', 'Red', 'Green']);
    const total = groups.reduce((n, g) => n + g.count, 0);
    expect(total).toBe(POOL.length);
    // count matches the cards array length
    for (const g of groups) expect(g.count).toBe(g.cards.length);
  });

  it('rarity grouping lists present rarities in order', () => {
    const groups = groupBySort(sortCards(POOL, 'rarity', 'asc'), 'rarity');
    expect(groups.map((g) => g.label)).toEqual(['Common', 'Uncommon', 'Rare', 'Mythic']);
  });

  it('value grouping labels like "Value N" and only non-empty', () => {
    const groups = groupBySort(POOL, 'value');
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) {
      expect(g.label).toMatch(/^Value \d+$/);
      expect(g.count).toBeGreaterThan(0);
    }
  });

  it('name grouping is first-letter sections', () => {
    const groups = groupBySort(sortCards(POOL, 'name', 'asc'), 'name');
    expect(groups.length).toBeGreaterThan(1);
    for (const g of groups) expect(g.label.length).toBe(1);
  });

  it('number grouping is a single "All" section', () => {
    const groups = groupBySort(POOL, 'number' as SortKey);
    expect(groups.length).toBe(1);
    expect(groups[0]!.label).toBe('All');
    expect(groups[0]!.count).toBe(POOL.length);
  });
});

describe('browse — paginate', () => {
  it('slices and reports pages', () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const p = paginate(items, 2, 10);
    expect(p.pages).toBe(3);
    expect(p.page).toBe(2);
    expect(p.slice).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it('clamps page into [1, pages]', () => {
    const items = Array.from({ length: 5 }, (_, i) => i);
    expect(paginate(items, 99, 10).page).toBe(1);
    expect(paginate(items, 0, 10).page).toBe(1);
    expect(paginate(items, -3, 2).page).toBe(1);
  });

  it('empty list yields one empty page', () => {
    const p = paginate([], 1, 10);
    expect(p.pages).toBe(1);
    expect(p.slice).toEqual([]);
  });
});
