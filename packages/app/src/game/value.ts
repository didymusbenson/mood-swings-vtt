// Value Transparency — thin app-side wrappers over the engine primitives, bound
// to the app's shared `db`. Components call these instead of importing the raw
// engine functions so the db plumbing lives in one place.
//
// See docs/features/value-transparency.md and packages/engine/src/value-transparency.ts.

import {
  queries,
  valueProvenance,
  wouldBeValue,
  type GameState,
  type Mood,
  type ValueProvenance,
  type WouldBeChoices,
  type WouldBeResult,
} from '@mood-swings/engine';
import { db } from './db.js';

/** Full provenance for a mood in play (Controlled by / self clause / Modified by). */
export function moodProvenance(state: GameState, mood: Mood): ValueProvenance {
  return valueProvenance(db, state, mood);
}

/**
 * Cheap "is this mood's value computed?" check for the on-tile glow — avoids the
 * fuller board scan `moodProvenance` does when all we need is the indicator.
 */
export function moodComputed(mood: Mood): boolean {
  return mood.currentValue !== queries.printedValue(mood, db);
}

/** The value a hand/discard card WOULD have if `player` played it into the board now. */
export function handWouldBe(
  state: GameState,
  player: string,
  card: number,
  choices?: WouldBeChoices,
): WouldBeResult {
  return wouldBeValue(db, state, player, card, choices);
}
