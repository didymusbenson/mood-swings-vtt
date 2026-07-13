// Pure helpers for the client-side hand-order view state.
//
// The engine owns the *set* of cards in a player's hand (`state.hands[pid]`).
// The UI keeps a separate *ordering* of that set so a player can drag-reorder
// their hand without the engine caring. These helpers keep the two in sync:
//
//   - reconcileHandOrder: fold a fresh engine hand into a chosen order,
//     preserving the player's arrangement, appending newly drawn cards, and
//     dropping cards that were played/discarded.
//   - moveInArray: the reorder primitive (remove one item, reinsert it at a
//     display insertion point).

/**
 * Reconcile a previously chosen hand order against the authoritative engine
 * hand.
 *
 * Cards that survive keep their relative order from `prevOrder`; cards that are
 * new (present in `hand` but not `prevOrder`) are appended in engine order;
 * cards no longer in `hand` are dropped. Written multiset-safe (indexOf/splice)
 * so a hand that ever holds duplicate card numbers still reconciles cleanly.
 */
export function reconcileHandOrder(prevOrder: number[], hand: number[]): number[] {
  const remaining = [...hand];
  const result: number[] = [];
  for (const n of prevOrder) {
    const i = remaining.indexOf(n);
    if (i !== -1) {
      result.push(n);
      remaining.splice(i, 1);
    }
  }
  // Whatever is left in `remaining` is new since prevOrder was chosen — keep
  // engine order for those.
  for (const n of remaining) result.push(n);
  return result;
}

/**
 * Move the item at `from` to the insertion point `to`, where `to` is an index
 * in the *original* array's coordinate space (0..length, i.e. "before element
 * `to`"). Returns a new array; a no-op reorder (to === from or from + 1) yields
 * an equivalent ordering.
 */
export function moveInArray<T>(arr: T[], from: number, to: number): T[] {
  if (from < 0 || from >= arr.length) return [...arr];
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  if (item === undefined) return copy; // unreachable given the range guard
  // Removing `from` shifts everything after it left by one, so an insertion
  // point past `from` must be adjusted down by one.
  const dest = to > from ? to - 1 : to;
  copy.splice(Math.max(0, Math.min(dest, copy.length)), 0, item);
  return copy;
}
