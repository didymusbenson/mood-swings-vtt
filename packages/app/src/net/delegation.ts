// Opponent-choice delegation for networked play.
//
// Most cards are assembled entirely by the active player before dispatch (the engine
// takes one fully-specified Action). A handful of cards, though, contain a sub-choice
// that in the physical game belongs to the OTHER player — picking a card from their
// own hidden hand, or each player secretly choosing simultaneously. For those, the
// host must collect the sub-choice(s) from the right seat(s) BEFORE calling
// engine.apply, then merge them into the single `choices` object the engine already
// expects. No engine change: the engine never knows two humans contributed.
//
// The orchestration (partial action → choice-request → collect → atomic apply) lives
// in HostSession; this module defines the shared contract and the card catalog.

import type { Choices, PlayerId } from '@mood-swings/engine';

/**
 * Cards whose resolution requires a sub-choice from a seat OTHER than the active
 * player, per docs/card-notes.md (see docs/v2-multiplayer-spec.md §4). All of these
 * either let the affected player pick from their own hidden hand, or have every
 * player choose simultaneously:
 *
 *   86 Compulsion — victim picks a card from their hand to give
 *   31 Confusion  — each player simultaneously picks a hand card to pass
 *   78 Suspicion  — each chosen player simultaneously picks a discard
 *   68 Malice     — chosen player picks which two of their moods
 *   29 Avoidance  — each player simultaneously picks one of their moods to pass
 */
export const DELEGATED_CARDS: ReadonlySet<number> = new Set([86, 31, 78, 68, 29]);

/**
 * Cards where every player chooses at the same time and no one may see another's
 * pick first. The host withholds engine.apply until ALL responses are in, so the
 * responses live only in host memory until the single atomic apply.
 */
export const SIMULTANEOUS_CARDS: ReadonlySet<number> = new Set([31, 78, 29]);

export function isDelegated(card: number): boolean {
  return DELEGATED_CARDS.has(card);
}

/** Host → a seat: "fill this one slot of the card being played." */
export interface ChoiceRequest {
  /** Correlates the request with its response. */
  id: string;
  /** The card being played that triggered the delegation. */
  card: number;
  /** The seat asked to make this sub-choice. */
  seat: PlayerId;
  /** Index into the card's ChoiceSpec.slots that this seat must fill. */
  slotIndex: number;
  /**
   * Choices already assembled (by the active player and/or earlier delegated slots)
   * so the requested client can compute legal targets for its slot — e.g. a
   * `cardsFrom:'chosen'` slot needs the chosen `players` from a prior slot.
   */
  priorChoices: Choices;
  /** Slot label to show the chooser. */
  prompt: string;
}

/** A seat → host: the slice of `choices` this seat contributed for its slot. */
export interface ChoiceResponse {
  id: string;
  seat: PlayerId;
  choices: Choices;
}
