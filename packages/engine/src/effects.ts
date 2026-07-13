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
  /** Count of moods in play of a given colour (suppressed cards still count). */
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
  suppress(mood: Mood, duration: 'turn' | 'round' | 'sustained', bySelf?: boolean): void;
  steal(mood: Mood, to: PlayerId): void;
  giveMood(mood: Mood, to: PlayerId): void;
  rotateToSecondary(mood: Mood, on?: boolean): void;
  /** Grant N unconditional extra plays this turn (the player may decline). */
  grantAdditionalMood(n?: number): void;
  /** Grant an extra play this turn, usable only on a card matching the constraint. */
  grantConditionalMood(constraint: PlayConstraint): void;
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
   * This mood's intrinsic value given board state (before other moods'
   * modifiers). Defaults to the printed primary/secondary value.
   */
  intrinsicValue?(ctx: ValueContext): number;
  /** Modifiers this mood imposes on moods in play while it's in play. */
  whileInPlay?(ctx: ValueContext): ValueModifier[];
}

export const NO_EFFECTS: CardEffects = {};
