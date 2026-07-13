// Core domain model for the Mood Swings engine. See docs/RULES.md.

export type Color = 'white' | 'blue' | 'black' | 'red' | 'green' | 'colorless';
export type DieColor = 'white' | 'black'; // white = fixed value, black = variable
/** Standard rarities plus the two special printings (#134 foil Love, #135 Hurt Feelings). */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'mythic' | 'headliner' | 'helper';
/** Rarities that participate in box collation / the 133-card set. */
export const PLAYABLE_RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'mythic'];

/** A single die-driven value (a card may show one or two dice; values 0..12). */
export interface DieValue {
  /** Numeric value (sum of the shown dice). */
  value: number;
  dieColor: DieColor;
}

/**
 * Static, printed data for a card — the shape produced by tools/scrape-cards.mjs
 * (data/cards.json) plus, at load time, the behavioural `effects` hooks.
 */
export interface CardData {
  number: number;
  name: string;
  slug: string;
  color: Color;
  rarity: Rarity;
  /** Primary (top-right) value. */
  value: number;
  dieColor: DieColor;
  /** Secondary (lower-left) value, if the card has one. */
  secondaryValue: DieValue | null;
  rulesText: string | null;
  image: string;
  set: string;
}

export type PlayerId = string;
export type CardNumber = number;

/**
 * Suppression duration (value forced to 0 but identity/colour preserved):
 * - 'turn'      : until the end of the current turn
 * - 'round'     : until the end of the current round
 * - 'sustained' : for as long as the suppressing mood stays in play on its side
 */
export type Suppression = 'none' | 'turn' | 'round' | 'sustained';

/** An instance of a card that is in play (a "mood"). */
export interface Mood {
  /** Unique per instance (a card can enter/leave play multiple times). */
  uid: string;
  card: CardNumber;
  /** Current controller. */
  owner: PlayerId;
  /** Who it was taken from, for "give back" effects (null if never stolen). */
  stolenFrom: PlayerId | null;
  /** Showing the secondary value (card rotated 180°). */
  usingSecondary: boolean;
  suppressed: Suppression;
  /** uid of the mood sustaining a 'sustained' suppression, if any. */
  suppressedBy: string | null;
  /** If this mood is copying another card, that card's number. */
  copyOf: CardNumber | null;
  /** Filled by the value-stabilisation pass; read by scoring/queries. */
  currentValue: number;
  /** Per-instance scratch space for card effects. */
  data: Record<string, unknown>;
}

/** Serializable constraint on an extra ("additional mood") play. */
export type PlayConstraint =
  | { kind: 'primaryValueIn'; values: number[] } // top-right printed value in set
  | { kind: 'colorNotSharedWithControllerMoods' } // Benevolence
  | { kind: 'whileMoodCountBelow'; target: number }; // Pride — repeatable until met

export interface ConditionalGrant {
  constraint: PlayConstraint;
}

export type Phase =
  | 'setup'
  | 'awaitingPlay' // a player must play or pass
  | 'scoring'
  | 'afterScoring'
  | 'roundEnd'
  | 'gameOver';

export interface PlayerState {
  id: PlayerId;
  name: string;
  roundsWon: number;
}

export interface LogEntry {
  round: number;
  message: string;
}

export interface GameState {
  players: PlayerState[];
  /** Shared draw pile (index 0 = top). */
  deck: CardNumber[];
  /** Shared discard pile. */
  discard: CardNumber[];
  hands: Record<PlayerId, CardNumber[]>;
  moods: Record<PlayerId, Mood[]>;

  phase: Phase;
  round: number;
  /** Whose turn it is right now. */
  activePlayer: PlayerId;
  /** Unconditional plays left in the active player's current turn (starts at 1). */
  playsRemaining: number;
  /** Conditional extra plays granted this turn (each usable once, if it matches). */
  conditionalGrants: ConditionalGrant[];
  /** uids of moods the active player has played so far this turn. */
  playedThisTurn: string[];
  /** Who leads the current round (wins ties). */
  firstPlayer: PlayerId;
  /** Turn order for the round (clockwise from firstPlayer). */
  turnOrder: PlayerId[];
  /** Players who have completed their turn this round, in play order. */
  actedThisRound: PlayerId[];
  /** Scores captured at scoring time (for after-scoring effects). */
  roundScores: Record<PlayerId, number>;
  /** Set once a player reaches 3 round wins. */
  winner: PlayerId | null;

  /** Deterministic RNG state (see rng.ts). */
  seed: number;
  uidCounter: number;
  log: LogEntry[];
}

export const ROUNDS_TO_WIN = 3;
export const STARTING_HAND = 5;
