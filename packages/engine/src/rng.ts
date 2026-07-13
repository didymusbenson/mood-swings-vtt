// Deterministic RNG so games are reproducible and server/client stay in sync.
// mulberry32 — tiny, fast, good enough for shuffling a card game.

export function nextRandom(seed: number): { value: number; seed: number } {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, seed: t >>> 0 };
}

/** Fisher–Yates using the seeded RNG. Returns the shuffled array + new seed. */
export function shuffle<T>(items: readonly T[], seed: number): { items: T[]; seed: number } {
  const arr = items.slice();
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    const r = nextRandom(s);
    s = r.seed;
    const j = Math.floor(r.value * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return { items: arr, seed: s };
}
