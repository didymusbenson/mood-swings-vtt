import { describe, expect, it } from 'vitest';
import { db } from './db.js';
import { addCopy, setCount, type DeckCounts } from './deckModel.js';
import { parseDeck, serializeDeck } from './deckText.js';

const CHARITY = 3; // "Charity"
const SADNESS = 74; // "Sadness"
const LOVE_POOL = 127; // "Love" — the playable mythic (not the #134 headliner)

describe('deckText — serialize', () => {
  it('emits one line per card ascending by number, optional header', () => {
    let d: DeckCounts = new Map();
    d = setCount(d, SADNESS, 2);
    d = setCount(d, CHARITY, 1);
    const text = serializeDeck(d, db);
    expect(text).toBe('1 Charity\n2 Sadness');

    const named = serializeDeck(d, db, 'My Deck');
    expect(named.split('\n')[0]).toBe('# My Deck — 3 cards');
  });
});

describe('deckText — parse', () => {
  it('handles counts, bare names, x-suffix, comments, blanks', () => {
    const text = ['# a title', '3 Charity', 'Sadness', '2x Love', '', '   '].join('\n');
    const { counts, unmatched } = parseDeck(text, db);
    expect(unmatched).toEqual([]);
    expect(counts.get(CHARITY)).toBe(3);
    expect(counts.get(SADNESS)).toBe(1);
    expect(counts.get(LOVE_POOL)).toBe(2); // resolves to the playable Love
  });

  it('matches names case-insensitively and trims', () => {
    const { counts, unmatched } = parseDeck('  2   sAdNeSs  ', db);
    expect(unmatched).toEqual([]);
    expect(counts.get(SADNESS)).toBe(2);
  });

  it('sums repeated names', () => {
    const { counts } = parseDeck('1 Charity\n2 Charity', db);
    expect(counts.get(CHARITY)).toBe(3);
  });

  it('reports unmatched lines verbatim', () => {
    const { counts, unmatched } = parseDeck('3 Charity\n2 Notacard\nGibberish', db);
    expect(counts.get(CHARITY)).toBe(3);
    expect(unmatched).toEqual(['2 Notacard', 'Gibberish']);
  });
});

describe('deckText — round-trip', () => {
  it('serialize -> parse reproduces the counts', () => {
    let d: DeckCounts = new Map();
    d = addCopy(d, CHARITY);
    d = addCopy(d, CHARITY);
    d = addCopy(d, SADNESS);
    d = addCopy(d, LOVE_POOL);
    const text = serializeDeck(d, db, 'Round Trip');
    const { counts, unmatched } = parseDeck(text, db);
    expect(unmatched).toEqual([]);
    expect([...counts.entries()].sort()).toEqual([...d.entries()].sort());
  });
});
