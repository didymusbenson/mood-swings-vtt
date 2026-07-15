import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addCopy, setCount, type DeckCounts } from './deckModel.js';
import {
  deleteDeck,
  duplicateDeck,
  getViewPref,
  listDecks,
  loadDeckCounts,
  renameDeck,
  saveDeck,
  setViewPref,
} from './deckStorage.js';

// vitest here runs in a node environment (no jsdom), so provide a tiny
// in-memory localStorage shim. If a real one exists we leave it alone.
class MemoryStorage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, String(v));
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null;
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage =
    new MemoryStorage() as unknown as Storage;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const CHARITY = 3;
const SADNESS = 74;

function sampleDeck(): DeckCounts {
  let d: DeckCounts = new Map();
  d = setCount(d, CHARITY, 2);
  d = addCopy(d, SADNESS);
  return d;
}

describe('deckStorage — save / list / load', () => {
  it('saveDeck creates with an id, listDecks returns it', () => {
    const saved = saveDeck('Aggro', sampleDeck());
    expect(saved.id).toBeTruthy();
    expect(saved.cards).toEqual({ '3': 2, '74': 1 });
    const list = listDecks();
    expect(list.length).toBe(1);
    expect(list[0]!.name).toBe('Aggro');
  });

  it('saveDeck with an id updates in place', () => {
    const first = saveDeck('Aggro', sampleDeck());
    const again = saveDeck('Aggro v2', addCopy(sampleDeck(), CHARITY), first.id);
    expect(again.id).toBe(first.id);
    expect(listDecks().length).toBe(1);
    expect(listDecks()[0]!.name).toBe('Aggro v2');
    expect(again.cards['3']).toBe(3);
  });

  it('listDecks sorts by updatedAt desc', () => {
    // Stub the clock so timestamps strictly increase regardless of resolution.
    let t = 1000;
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => (t += 1000));
    const a = saveDeck('A', sampleDeck());
    const b = saveDeck('B', sampleDeck());
    const c = saveDeck('C', sampleDeck());
    spy.mockRestore();
    expect(listDecks().map((d) => d.id)).toEqual([c.id, b.id, a.id]);
  });

  it('loadDeckCounts rebuilds the count map', () => {
    const saved = saveDeck('Aggro', sampleDeck());
    const { counts, dropped } = loadDeckCounts(saved);
    expect(dropped).toEqual([]);
    expect(counts.get(CHARITY)).toBe(2);
    expect(counts.get(SADNESS)).toBe(1);
  });

  it('loadDeckCounts drops unknown card numbers', () => {
    const saved = saveDeck('Aggro', sampleDeck());
    saved.cards['99999'] = 3; // number not in the db
    const { counts, dropped } = loadDeckCounts(saved);
    expect(dropped).toEqual([99999]);
    expect(counts.has(99999)).toBe(false);
    expect(counts.get(CHARITY)).toBe(2);
  });
});

describe('deckStorage — rename / duplicate / delete', () => {
  it('renameDeck changes the name', () => {
    const saved = saveDeck('Old', sampleDeck());
    renameDeck(saved.id, 'New');
    expect(listDecks()[0]!.name).toBe('New');
  });

  it('duplicateDeck copies under a new id with a "(copy)" name', () => {
    const saved = saveDeck('Orig', sampleDeck());
    const dup = duplicateDeck(saved.id);
    expect(dup).not.toBeNull();
    expect(dup!.id).not.toBe(saved.id);
    expect(dup!.name).toBe('Orig (copy)');
    expect(dup!.cards).toEqual(saved.cards);
    expect(listDecks().length).toBe(2);
  });

  it('duplicateDeck returns null for an unknown id', () => {
    expect(duplicateDeck('nope')).toBeNull();
  });

  it('deleteDeck removes it', () => {
    const saved = saveDeck('Gone', sampleDeck());
    deleteDeck(saved.id);
    expect(listDecks().length).toBe(0);
  });
});

describe('deckStorage — view preference', () => {
  it('round-trips the view pref', () => {
    expect(getViewPref()).toBeNull();
    setViewPref('detailed');
    expect(getViewPref()).toBe('detailed');
  });
});

describe('deckStorage — resilience', () => {
  it('listDecks returns [] when storage is unavailable', () => {
    (globalThis as unknown as { localStorage: Storage | undefined }).localStorage = undefined;
    expect(listDecks()).toEqual([]);
    expect(getViewPref()).toBeNull();
    // mutators must not throw
    expect(() => saveDeck('x', sampleDeck())).not.toThrow();
    expect(() => setViewPref('v')).not.toThrow();
  });
});
