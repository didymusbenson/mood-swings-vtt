import { describe, expect, it } from 'vitest';
import { db } from './db.js';
import { PRESET_DECKS, PRESET_COPIES, presetFlat, presetCounts, presetById } from './presetDecks.js';

/** Playable pool = every card that isn't the non-playable headliner/helper. */
const playable = db
  .all()
  .filter((c) => c.rarity !== 'headliner' && c.rarity !== 'helper')
  .map((c) => c.number);

describe('presetDecks — structure', () => {
  it('each deck is exactly five distinct, existing, playable moods', () => {
    for (const d of PRESET_DECKS) {
      expect(d.moods, `${d.id} length`).toHaveLength(5);
      expect(new Set(d.moods).size, `${d.id} distinct`).toBe(5);
      for (const n of d.moods) {
        expect(db.has(n), `${d.id} has card #${n}`).toBe(true);
        expect(playable, `${d.id} card #${n} is playable`).toContain(n);
      }
    }
  });

  it('deck ids are unique', () => {
    const ids = PRESET_DECKS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('presetDecks — coverage', () => {
  it('the suite covers every playable card at least once', () => {
    const covered = new Set(PRESET_DECKS.flatMap((d) => d.moods));
    const missing = playable.filter((n) => !covered.has(n));
    expect(missing, `uncovered: ${missing.map((n) => `${n} ${db.get(n).name}`).join(', ')}`).toEqual([]);
  });
});

describe('presetDecks — expansion', () => {
  it('presetFlat yields 15 cards (5 × PRESET_COPIES), ascending, repeats = copies', () => {
    const flat = presetFlat(PRESET_DECKS[0]!);
    expect(flat).toHaveLength(5 * PRESET_COPIES);
    expect([...flat]).toEqual([...flat].sort((a, b) => a - b));
    for (const n of PRESET_DECKS[0]!.moods) {
      expect(flat.filter((x) => x === n)).toHaveLength(PRESET_COPIES);
    }
  });

  it('presetCounts maps each mood to PRESET_COPIES', () => {
    const counts = presetCounts(PRESET_DECKS[0]!);
    expect(counts.size).toBe(5);
    for (const v of counts.values()) expect(v).toBe(PRESET_COPIES);
  });

  it('presetById round-trips', () => {
    expect(presetById(PRESET_DECKS[0]!.id)).toBe(PRESET_DECKS[0]);
    expect(presetById('nope')).toBeUndefined();
  });
});
