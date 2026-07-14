// Value Transparency — engine primitives the app renders on top of.
//
// See docs/features/value-transparency.md. This module is PURE: every function
// takes a `CardDB` + a serialisable `GameState` and returns plain data. Nothing
// here mutates the real game state — the would-be dry-run works on a
// `structuredClone` and throws it away.
//
// Two primitives:
//   1. `wouldBeValue`   — the value a hand/discard card WOULD have if played now
//                         (self-included dry-run of the existing stabilise()
//                         fixpoint; ignores costs and post-resolution; honours
//                         static field modifiers already in play).
//   2. `valueProvenance` — for a mood IN PLAY, whether its current value differs
//                         from printed and WHY: its own clause (key into the
//                         highlight metadata) and/or other cards ("Modified by X").

import type { Color, GameState, Mood, PlayerId } from './types.js';
import type { ReadContext, ValueModifier } from './effects.js';
import { CardDB, effectsFor } from './cards/registry.js';
import { Engine } from './engine.js';
import {
  allMoods,
  colorOf,
  countColor,
  moodiest,
  mostCommonColors,
  printedValue,
  resolveCardNumber,
} from './queries.js';
import { highlightFor } from './cards/highlights.js';

/**
 * Cards whose OWN value depends on a player CHOICE, so no passive would-be is
 * projected for a card sitting in hand (docs ruling #4). They only resolve once
 * the choice is known — pass it via `wouldBeValue`'s `choices` argument (the
 * decision-modal preview):
 *   - #32 Creativity — value is a COPY of the chosen mood → needs `choices.copy`.
 *   - #133 Wonder    — value scales with the chosen COLOUR → needs `choices.wonderColor`.
 */
export const TARGET_DEPENDENT_VALUE_CARDS: ReadonlySet<number> = new Set([32, 133]);

/** Selections that, when known (decision modal), make a target-dependent value computable. */
export interface WouldBeChoices {
  /** #32 Creativity: the card number this mood copies. */
  copy?: number;
  /** #133 Wonder: the chosen colour its value scales with. */
  wonderColor?: Color;
}

export interface WouldBeResult {
  /**
   * True when a would-be value is objectively computable (no unresolved player
   * choice). False for target-dependent cards until the relevant `choices` are
   * supplied — in that case `value` is null and the app shows no would-be.
   */
  readonly objective: boolean;
  /** The computed would-be value, or null when not objective. */
  readonly value: number | null;
  /** The card's printed primary value, for comparison / the plain die. */
  readonly printed: number;
  /**
   * True when the would-be differs from the printed value (drive the computed
   * glow). Always false when not objective.
   */
  readonly computed: boolean;
}

/**
 * The value `cardNumber` WOULD have if `player` played it into the current board
 * right now — a dry-run of the engine's `stabilise()` fixpoint with the card
 * hypothetically added to the player's moods, SELF-INCLUDED.
 *
 * - Self-inclusion is automatic (the synthesized mood is on the board before
 *   stabilising), so count-based values reflect the card's own presence.
 * - This-turn values apply (`data.playedRound === round`), e.g. Patience → 1.
 * - Static field modifiers already in play are honoured (they are just part of
 *   stabilise). Play costs and after-playing resolution are NOT simulated.
 * - Target-dependent cards (#32/#133) return `{ objective: false, value: null }`
 *   unless the deciding `choices` are supplied (decision-modal preview).
 *
 * Pure: never mutates `state` (operates on a structuredClone).
 */
export function wouldBeValue(
  db: CardDB,
  state: GameState,
  player: PlayerId,
  cardNumber: number,
  choices?: WouldBeChoices,
): WouldBeResult {
  const printed = db.get(cardNumber).value;

  // Target-dependent value with no supplied choice → not objective, no would-be.
  const needsCopy = cardNumber === 32 && choices?.copy == null;
  const needsColor = cardNumber === 133 && choices?.wonderColor == null;
  if (needsCopy || needsColor) {
    return { objective: false, value: null, printed, computed: false };
  }

  const clone = structuredClone(state);
  const mood: Mood = {
    // A parseable `m<n>` uid keeps play-order semantics (Imagination override).
    uid: `m${clone.uidCounter++}`,
    card: cardNumber,
    owner: player,
    stolenFrom: null,
    usingSecondary: false,
    suppressed: 'none',
    suppressedBy: null,
    copyOf: choices?.copy ?? null,
    currentValue: 0,
    data: {
      playedRound: clone.round,
      ...(choices?.wonderColor ? { wonderColor: choices.wonderColor } : {}),
    },
  };
  (clone.moods[player] ??= []).push(mood);

  new Engine(db).stabilise(clone);

  const settled = clone.moods[player]!.find((m) => m.uid === mood.uid)!;
  const value = settled.currentValue;
  return { objective: true, value, printed, computed: value !== printed };
}

/** One other card currently affecting a mood's value ("Modified by {name}"). */
export interface ExternalModifier {
  /** uid of the responsible mood in play. */
  readonly uid: string;
  /** Card number of the responsible mood (resolves copyOf). */
  readonly cardNumber: number;
  /** Display name for the "Modified by {name}" line. */
  readonly name: string;
  /** How it modifies: forced-to-0 suppression, or a while-in-play value modifier. */
  readonly kind: 'suppress' | 'modifier';
}

export interface ValueProvenance {
  /** Printed primary/secondary value for this mood (honours rotation/copy). */
  readonly printed: number;
  /** Live computed value (`mood.currentValue`). */
  readonly current: number;
  /** True when the current value differs from the printed value (computed glow). */
  readonly computed: boolean;
  /**
   * Set when the mood's OWN rules text drives its value: `cardNumber` keys into
   * `highlightFor(cardNumber)` for the clause to <mark>. Null when the mood's own
   * text is not currently driving a non-default value.
   */
  readonly self: { readonly cardNumber: number; readonly clause: string } | null;
  /** Other cards currently modifying this mood's value (may be several). */
  readonly external: ExternalModifier[];
}

/**
 * Explain a mood-in-play's current value: whether it is modified from printed,
 * and by what — its own clause (self) and/or other cards (external). Assumes
 * `state` has been stabilised (reads `mood.currentValue`). Pure / read-only.
 */
export function valueProvenance(db: CardDB, state: GameState, mood: Mood): ValueProvenance {
  const n = resolveCardNumber(mood);
  const printed = printedValue(mood, db);
  const current = mood.currentValue;

  // --- self: the mood's own clause is the branch driving its value right now.
  const hl = highlightFor(n);
  const selfActive = hl ? hl.condition(makeReadContext(db, state, mood)) : false;
  const self = selfActive && hl ? { cardNumber: n, clause: hl.clause } : null;

  // --- external: suppression + other moods' while-in-play modifiers.
  const external: ExternalModifier[] = [];
  const nameOf = (m: Mood) => db.get(resolveCardNumber(m)).name;

  if (mood.suppressed !== 'none') {
    // The suppressor is only recorded for sustained (bySelf) suppression; turn/
    // round suppressions don't retain a source, so we can only name it then.
    const by = mood.suppressedBy
      ? allMoods(state).find((m) => m.uid === mood.suppressedBy)
      : undefined;
    if (by) {
      external.push({ uid: by.uid, cardNumber: resolveCardNumber(by), name: nameOf(by), kind: 'suppress' });
    }
  }

  for (const source of allMoods(state)) {
    if (source.uid === mood.uid) continue; // self-modification is the `self` path.
    const eff = effectsFor(resolveCardNumber(source));
    if (!eff.whileInPlay) continue;
    const srcCtx = makeReadContext(db, state, source);
    let mods: ValueModifier[];
    try {
      mods = eff.whileInPlay(srcCtx);
    } catch {
      continue;
    }
    if (mods.some((mod) => mod.appliesTo(mood, srcCtx))) {
      external.push({
        uid: source.uid,
        cardNumber: resolveCardNumber(source),
        name: nameOf(source),
        kind: 'modifier',
      });
    }
  }

  return { printed, current, computed: current !== printed, self, external };
}

/**
 * Build a read-only ReadContext for `self`, mirroring Engine.readContext. Used to
 * re-evaluate highlight conditions and while-in-play `appliesTo` predicates from
 * outside the engine. `valueOf` reads the last-stabilised `currentValue`.
 */
function makeReadContext(db: CardDB, state: GameState, self: Mood): ReadContext {
  return {
    state,
    self,
    card: (mood) => db.get(resolveCardNumber(mood)),
    cardData: (cardNumber) => db.get(cardNumber),
    valueOf: (mood) => mood.currentValue,
    allMoods: () => allMoods(state),
    moodsOf: (player) => state.moods[player] ?? [],
    opponentsOf: (player) => state.players.map((p) => p.id).filter((id) => id !== player),
    colorOf: (mood) => colorOf(mood, db),
    countColor: (color: Color) => countColor(state, db, color),
    mostCommonColors: () => mostCommonColors(state, db),
    moodiest: () => moodiest(state),
  };
}
