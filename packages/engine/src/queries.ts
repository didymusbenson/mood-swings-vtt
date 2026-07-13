// Board queries shared by value computation and effect resolution.

import type { Color, GameState, Mood, PlayerId } from './types.js';
import type { CardDB } from './cards/registry.js';

export function allMoods(state: GameState): Mood[] {
  return state.players.flatMap((p) => state.moods[p.id] ?? []);
}

export function resolveCardNumber(mood: Mood): number {
  return mood.copyOf ?? mood.card;
}

export function colorOf(mood: Mood, db: CardDB): Color {
  return db.get(resolveCardNumber(mood)).color;
}

/** Printed value for a mood, honouring secondary-value rotation and copying. */
export function printedValue(mood: Mood, db: CardDB): number {
  const data = db.get(resolveCardNumber(mood));
  if (mood.usingSecondary && data.secondaryValue) return data.secondaryValue.value;
  return data.value;
}

export function countColor(state: GameState, db: CardDB, color: Color): number {
  return allMoods(state).filter((m) => colorOf(m, db) === color).length;
}

export function mostCommonColors(state: GameState, db: CardDB): Color[] {
  const counts = new Map<Color, number>();
  for (const m of allMoods(state)) {
    const c = colorOf(m, db);
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let max = 0;
  for (const n of counts.values()) max = Math.max(max, n);
  if (max === 0) return [];
  return [...counts.entries()].filter(([, n]) => n === max).map(([c]) => c);
}

export function moodiest(state: GameState): PlayerId[] {
  let max = 0;
  for (const p of state.players) max = Math.max(max, (state.moods[p.id] ?? []).length);
  return state.players.filter((p) => (state.moods[p.id] ?? []).length === max).map((p) => p.id);
}

export function findMood(state: GameState, uid: string): Mood | undefined {
  return allMoods(state).find((m) => m.uid === uid);
}

export function ownerOf(state: GameState, uid: string): PlayerId | undefined {
  for (const p of state.players) {
    if ((state.moods[p.id] ?? []).some((m) => m.uid === uid)) return p.id;
  }
  return undefined;
}
