import { describe, expect, it } from 'vitest';
import { reconcileHandOrder, moveInArray } from './handOrder.js';

describe('reconcileHandOrder', () => {
  it('falls back to engine order when there is no prior order', () => {
    expect(reconcileHandOrder([], [10, 20, 30])).toEqual([10, 20, 30]);
  });

  it('preserves the chosen order for cards that are still present', () => {
    // Player rearranged their hand to [30, 10, 20]; engine hand is unchanged.
    expect(reconcileHandOrder([30, 10, 20], [10, 20, 30])).toEqual([30, 10, 20]);
  });

  it('drops cards that left the hand (played/discarded) but keeps order', () => {
    // 10 was played; 20 and 30 keep their chosen order.
    expect(reconcileHandOrder([30, 10, 20], [20, 30])).toEqual([30, 20]);
  });

  it('appends newly drawn cards in engine order at the end', () => {
    // 40, 41 were drawn this turn; they land after the arranged cards.
    expect(reconcileHandOrder([30, 10, 20], [10, 20, 30, 40, 41])).toEqual([
      30, 10, 20, 40, 41,
    ]);
  });

  it('handles simultaneous removals and additions', () => {
    // 10 left, 99 arrived.
    expect(reconcileHandOrder([30, 10, 20], [20, 30, 99])).toEqual([30, 20, 99]);
  });

  it('is multiset-safe with duplicate card numbers', () => {
    // Defensive: if a hand ever holds two of the same number, both survive.
    expect(reconcileHandOrder([7, 7, 3], [3, 7, 7])).toEqual([7, 7, 3]);
    expect(reconcileHandOrder([7, 3], [3, 7, 7])).toEqual([7, 3, 7]);
  });
});

describe('moveInArray', () => {
  const base = [1, 2, 3, 4];

  it('moves an item forward to a later insertion point', () => {
    // Move index 0 (=1) to insertion point 3 -> [2,3,1,4]
    expect(moveInArray(base, 0, 3)).toEqual([2, 3, 1, 4]);
  });

  it('moves an item backward to an earlier insertion point', () => {
    // Move index 3 (=4) to insertion point 1 -> [1,4,2,3]
    expect(moveInArray(base, 3, 1)).toEqual([1, 4, 2, 3]);
  });

  it('is a no-op when dropped in its own slot', () => {
    expect(moveInArray(base, 1, 1)).toEqual([1, 2, 3, 4]);
    expect(moveInArray(base, 1, 2)).toEqual([1, 2, 3, 4]);
  });

  it('can move to the very end', () => {
    expect(moveInArray(base, 0, 4)).toEqual([2, 3, 4, 1]);
  });

  it('ignores an out-of-range source index', () => {
    expect(moveInArray(base, 9, 0)).toEqual([1, 2, 3, 4]);
  });
});
