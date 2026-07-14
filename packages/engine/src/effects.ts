// The per-card effect interface. Each of the ~130 cards implements the subset of
// these hooks it needs; the engine orchestrates *when* they run (see engine.ts
// and docs/RULES.md "Order of operations" and "Scoring"/"After scoring").

import type { CardData, Color, GameState, Mood, PlayConstraint, PlayerId } from './types.js';

/** Read-only helpers available to value computation and effect resolution. */
export interface ReadContext {
  readonly state: GameState;
  /** The mood whose effect is running. */
  readonly self: Mood;
  /** Static data for a mood, resolving `copyOf`. */
  card(mood: Mood): CardData;
  /** Static data for a card number (e.g. to inspect a card in hand). */
  cardData(cardNumber: number): CardData;
  /** Current value of a mood (as of the last stabilisation pass). */
  valueOf(mood: Mood): number;
  /** Every mood in play, across all players. */
  allMoods(): Mood[];
  moodsOf(player: PlayerId): Mood[];
  /** Players other than the given one. */
  opponentsOf(player: PlayerId): PlayerId[];
  /**
   * A mood's current in-play colour, honouring an active colour override
   * (Imagination #42). Use this for any "shares a colour / colour in play"
   * check on a mood in play. For the printed/identity colour of a card (in hand,
   * in the discard pile, or a card number), read `card(mood).color` /
   * `cardData(n).color` instead — those zones are not recoloured.
   */
  colorOf(mood: Mood): Color;
  /** Count of moods in play of a given colour (honours overrides; suppressed cards still count). */
  countColor(color: Color): number;
  /** Colour(s) with the most moods in play (ties → all of them). */
  mostCommonColors(): Color[];
  /** Player(s) with the most moods in play. */
  moodiest(): PlayerId[];
}

export type ValueOp =
  | { kind: 'add'; n: number }
  | { kind: 'set'; n: number }
  | { kind: 'max'; n: number }; // value becomes max(current, n)

/** A modifier one mood imposes on moods in play while it remains in play. */
export interface ValueModifier {
  appliesTo(mood: Mood, ctx: ReadContext): boolean;
  op: ValueOp;
  /** 'add' ops apply before 'set' ops regardless; ties broken by insertion. */
}

/** Mutations available while resolving a play or an after-scoring effect. */
export interface MutationApi {
  /** The player taking the turn (controller of `self`). */
  readonly me: PlayerId;
  /** Decisions the acting player supplied with the action (targets, choices). */
  readonly choices: Choices;
  discardMoodToPile(mood: Mood): void;
  returnMoodToHand(mood: Mood, to?: PlayerId): void;
  discardFromHand(player: PlayerId, card: number): void;
  draw(player: PlayerId, n?: number): void;
  /** Put a mood on the bottom of the shared deck (leaves play). */
  putOnBottomOfDeck(mood: Mood): void;
  /**
   * Force a mood to value 0 for the given duration. For 'sustained', pass
   * `bySelf: true` so the engine records THIS mood (`ctx.self`) as the suppressor;
   * the suppression then clears automatically when this mood leaves play or changes
   * owner (RULES.md: "stops if that card changes owner").
   */
  suppress(mood: Mood, duration: 'turn' | 'round' | 'sustained', bySelf?: boolean): void;
  /**
   * Re-settle every mood's "While in play" value right now. Two-part "after playing"
   * cards (Hostility #94, Worry #52) MUST call this between their two sub-effects so
   * the second sub-effect (which cares about current values) sees the board AFTER the
   * first sub-effect — read `mood.currentValue` afterwards, not the frozen `valueOf`.
   */
  restabilize(): void;
  steal(mood: Mood, to: PlayerId): void;
  giveMood(mood: Mood, to: PlayerId): void;
  rotateToSecondary(mood: Mood, on?: boolean): void;
  /** Grant N unconditional extra plays this turn (the player may decline). */
  grantAdditionalMood(n?: number): void;
  /**
   * Grant N extra plays this turn that must be played FROM THE DISCARD PILE
   * (Angst, Grief, Harmony). Consumed by a `{ from: 'discard' }` play.
   */
  grantDiscardMood(n?: number): void;
  /**
   * Grant an extra play this turn, usable only on a card matching the constraint.
   * `from` selects the source zone: 'hand' (default, a normal play — Benevolence,
   * Eagerness) or 'discard' (a discard-pile play — Grace #121's colour-matched grant).
   */
  grantConditionalMood(constraint: PlayConstraint, from?: 'hand' | 'discard'): void;
  /**
   * Grant `player` N extra plays at the START of their NEXT turn (one-time, cross-turn).
   * Joy #125 grants to `me`; Generosity #120 grants to the chosen opponent. Fills the
   * serializable `GameState.pendingExtraPlays` counter, folded into `playsRemaining`
   * at that player's turn start and consumed once.
   */
  grantExtraPlayNextTurn(player: PlayerId, n?: number): void;
  /**
   * Grant `player` N extra DISCARD plays at the start of their next turn (one-time,
   * cross-turn — the discard-play analogue of `grantExtraPlayNextTurn`).
   */
  grantDiscardPlayNextTurn(player: PlayerId, n?: number): void;
  /** Deterministic random integer in [0, maxExclusive) (advances the game seed). */
  random(maxExclusive: number): number;
  log(message: string): void;
}

export type PlayContext = ReadContext & MutationApi;
export type ScoreContext = ReadContext & MutationApi;
export type ValueContext = ReadContext;

/** Player-supplied decisions for a single action (kept intentionally loose). */
export interface Choices {
  /** Targeted player(s), e.g. "choose an opponent". */
  players?: PlayerId[];
  /** Targeted mood uids. */
  moods?: string[];
  /** Cards chosen from hand (card numbers). */
  cards?: number[];
  /** Which of two values to take, etc. */
  option?: string | number;
  /**
   * The card number a copy effect adopts (Creativity #32: "play this card as a copy
   * of any mood"). Kept separate from `moods`/`cards` so the copied card's OWN target
   * choices (which use `moods`/`players`/`cards`/…) are never confused with the pick
   * of what to copy.
   */
  copy?: number;
  [key: string]: unknown;
}

/** The behavioural contract a card can implement. All hooks optional. */
export interface CardEffects {
  /** Can the "To play this card" cost be paid right now? Defaults to true. */
  canPlay?(ctx: PlayContext): boolean;
  /** Pay the "To play this card" cost (runs before the mood enters play). */
  payCost?(ctx: PlayContext): void;
  /** "After playing this mood" — resolved after while-in-play stabilises. */
  afterPlaying?(ctx: PlayContext): void;
  /** "After scoring" — resolved in turn order before losers draw. */
  afterScoring?(ctx: ScoreContext): void;

  /**
   * Fires when this mood's controller plays ANOTHER mood later in the same game
   * ("each time you play another mood" — e.g. Scorn, Validation). `played` is
   * the mood just put into play.
   */
  onOtherMoodPlayed?(ctx: PlayContext, played: Mood): void;

  /**
   * While in play, forces a specific player to lead each round (e.g. Honor).
   * Returns the forced first player, or null for no override.
   */
  forcesFirstPlayer?(ctx: ReadContext): PlayerId | null;

  /**
   * While in play, grants its OWNER extra plays at the start of EACH of the owner's
   * turns ("during each of your turns"). Re-evaluated at every turn start against the
   * live board, so the grant fires every turn the mood is in play and stops once it
   * leaves play. `normal` adds to `playsRemaining`; `fromDiscard` adds to
   * `discardPlaysRemaining`. Hope #124 → `{ normal: 1 }`; Grace #121 → `{ fromDiscard: 1 }`;
   * Stubbornness #102 → `{ normal: 1 }` only when its start-of-turn condition holds.
   * `ctx.self` is the mood; use `ctx.self.owner` for the active player. NB: the turn a
   * mood is played, its own `afterPlaying` covers the "including the turn you play this
   * mood" grant (turn start has already passed by then).
   *
   * `grants` adds CONSTRAINED extra plays at turn start (pushed as `ConditionalGrant`s):
   * Grace #121 → `{ grants: [{ constraint: { kind: 'colorSharedWithControllerMoods' }, from: 'discard' }] }`
   * so the recurring discard play is usable only on a colour-matching discard card.
   */
  extraPlaysAtTurnStart?(ctx: ReadContext): {
    normal?: number;
    fromDiscard?: number;
    grants?: { constraint: PlayConstraint; from?: 'hand' | 'discard' }[];
  };

  /**
   * This mood's intrinsic value given board state (before other moods'
   * modifiers). Defaults to the printed primary/secondary value.
   */
  intrinsicValue?(ctx: ValueContext): number;
  /** Modifiers this mood imposes on moods in play while it's in play. */
  whileInPlay?(ctx: ValueContext): ValueModifier[];

  /**
   * While in play, forces EVERY mood (including this one) to a single colour
   * (Imagination #42: "All moods are the chosen colour and no other colours").
   * Returns the forced colour, or null for no override. If several moods return a
   * colour, the most recently played one wins (a later Imagination overrides an
   * earlier one). Recomputed continuously, so moods played after it are recoloured
   * too and everything reverts when the source leaves play.
   */
  colorOverride?(ctx: ReadContext): Color | null;

  /**
   * While in play, lets its controller play moods from the discard pile using a
   * normal play (Melancholy #69: "you may play moods from the discard pile as
   * though they were in your hand"). Unlike `grantDiscardMood`, this grants no
   * extra play — it only permits `{ from: 'discard' }` to consume a normal play.
   */
  permitsPlayFromDiscard?(ctx: ReadContext): boolean;

  /**
   * Extra points this mood contributes at scoring, on top of the base sum of every
   * mood's `currentValue` ("score … an extra time" effects). Applied during scoring
   * (after values stabilise, before the score is logged) so the logged scores and the
   * round winner both reflect it. Each entry adds `points` to `player`'s round score.
   * Bliss #108, Enthusiasm #116, Exhilaration #89 add to their owner; Passion #97 adds
   * a chosen opponent's mood value to its owner (the opponent still scores it normally).
   */
  scoreExtras?(ctx: ReadContext): { player: PlayerId; points: number }[];

  /**
   * While in play, cancels this round's scoring entirely (Awe #107: "There is no
   * scoring this round. No one wins or loses this round."). When any in-play mood
   * returns true, the round is not scored: no winner, no losers drawing, and no
   * after-scoring effects; the round still ends and advances. `chooseNextFirstPlayer`
   * (below) picks who leads next round.
   */
  cancelsRoundScoring?(ctx: ReadContext): boolean;

  /**
   * When a round's scoring is cancelled (see `cancelsRoundScoring`), the player who
   * leads next round ("You choose which player goes first next round" — Awe #107).
   * Returns null to fall back to the current first player.
   */
  chooseNextFirstPlayer?(ctx: ReadContext): PlayerId | null;

  /**
   * Extra ROUND WINS awarded to this round's winner while this mood is in play
   * (Corruption #60: "The winner of the current round wins two rounds instead of
   * one."). Summed over all in-play moods and added to the winner's `roundsWon` on
   * top of the base +1. Returns 0 when not active.
   */
  extraRoundWinsForWinner?(ctx: ReadContext): number;

  /**
   * Fired once when this mood LEAVES play (discarded, bottom-decked, or returned to
   * hand) — not when it merely changes controller (steal/give). Lets a mood undo a
   * lasting effect it set up: Arrogance #82 gives the mood it took back to its
   * original owner ("After this mood is no longer in play, give the mood you took
   * back to them"). Runs on the mood as it leaves, before it is removed from play.
   */
  onLeavePlay?(ctx: PlayContext): void;
}

export const NO_EFFECTS: CardEffects = {};
