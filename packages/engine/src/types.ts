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
  /** Illustrator credit (may be absent for some entries). */
  artist: string | null;
  /** Mark Rosewater's clarifications, joined at load from data/card-notes.json. */
  notes?: string[];
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
  /**
   * Overriding in-play colour (Imagination #42: "all moods are the chosen colour").
   * Null/undefined means "use the printed colour". Recomputed by the engine's
   * colour-override pass whenever the board changes, so it stays a derived cache
   * (serialisable — survives structuredClone). Read via queries.colorOf / ctx.colorOf.
   */
  colorOverride?: Color | null;
  /** Filled by the value-stabilisation pass; read by scoring/queries. */
  currentValue: number;
  /** Per-instance scratch space for card effects. */
  data: Record<string, unknown>;
}

/** Serializable constraint on an extra ("additional mood") play. */
export type PlayConstraint =
  | { kind: 'primaryValueIn'; values: number[] } // top-right printed value in set
  | { kind: 'colorNotSharedWithControllerMoods' } // Benevolence
  | { kind: 'colorSharedWithControllerMoods' } // Eagerness #114, Grace #121 (discard)
  | { kind: 'whileMoodCountBelow'; player: PlayerId }; // Pride — repeatable while below the chosen player's LIVE mood count

export interface ConditionalGrant {
  constraint: PlayConstraint;
  /**
   * Which zone the granted extra play must come from. 'hand' (default) is a normal
   * play; 'discard' is a discard-pile play (Grace #121's colour-matched discard
   * grant). Consumed by `consumePlay` ('hand') vs `consumeDiscardPlay` ('discard').
   */
  from?: 'hand' | 'discard';
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

export type LogKind =
  | 'play'
  | 'pass'
  | 'draw'
  | 'discard'
  | 'return'
  | 'bottomdeck'
  | 'suppress'
  | 'steal'
  | 'give'
  | 'score'
  | 'round'
  | 'game'
  | 'info';

/**
 * Per-mood contribution to a player's round score (Value Transparency: the log's
 * expandable per-round score explanation). Depth is one line per mood with its
 * computed value — no deeper modifier breakdown (that lives in the Preview).
 */
export interface ScoreMood {
  /** Display name of the mood (resolves copies to their source card). */
  name: string;
  /** The mood's computed value at scoring time. */
  value: number;
}

/** One player's round-score breakdown, attached to a 'score' log entry. */
export interface ScoreBreakdown {
  player: PlayerId;
  playerName: string;
  /** The player's final round total (includes any extra-scoring contributions). */
  total: number;
  moods: ScoreMood[];
}

/**
 * A single trace entry. `message` is the public text everyone sees. For hidden
 * information (e.g. a drawn card's identity), set `private` to the only player
 * who may see `message`; other viewers see `redacted` instead. In the v1 hotseat
 * everything is public, so the UI shows `message` for all — but the shape lets v2
 * conceal per-viewer without changing the engine.
 */
export interface LogEntry {
  round: number;
  message: string;
  kind?: LogKind;
  actor?: PlayerId;
  private?: PlayerId;
  redacted?: string;
  /**
   * Present on `kind: 'score'` entries: the per-player, per-mood value breakdown
   * captured at scoring time (moods leave play at round end, so the log retains
   * its own snapshot). Drives the log's expandable per-round score explanation.
   */
  scores?: ScoreBreakdown[];
}

export interface GameState {
  players: PlayerState[];
  /** Shared draw pile (index 0 = top). */
  deck: CardNumber[];
  /** Shared discard pile. */
  discard: CardNumber[];
  hands: Record<PlayerId, CardNumber[]>;
  moods: Record<PlayerId, Mood[]>;
  /**
   * Card numbers currently revealed from each player's hand and thus public knowledge:
   * Curiosity #33 / Paranoia #71 reveals, plus any mood that returns from play to a hand
   * (everyone saw which card went back). While a revealed card remains in the holder's
   * hand, redaction shows it face-up to opponents instead of a card back. It persists —
   * across rounds — until the card leaves the hand (played, discarded, given, passed):
   * the engine prunes it (see reconcileRevealed) the moment the hand no longer holds it.
   */
  revealed: Record<PlayerId, CardNumber[]>;

  phase: Phase;
  round: number;
  /** Whose turn it is right now. */
  activePlayer: PlayerId;
  /** Unconditional plays left in the active player's current turn (starts at 1). */
  playsRemaining: number;
  /**
   * Extra plays this turn that must be sourced from the discard pile (Angst #54,
   * Grief #65, Harmony #123, Grace #121). Consumed by a `{ from: 'discard' }` play.
   */
  discardPlaysRemaining: number;
  /** Conditional extra plays granted this turn (each usable once, if it matches). */
  conditionalGrants: ConditionalGrant[];
  /**
   * One-time extra plays owed to a player at the START of their NEXT turn (Joy #125
   * grants to self; Generosity #120 to a chosen opponent). At each player's turn
   * start the counter is folded into `playsRemaining` and reset to 0, so a grant is
   * consumed exactly once. Serializable (survives structuredClone).
   */
  pendingExtraPlays: Record<PlayerId, number>;
  /**
   * One-time extra DISCARD plays owed to a player at the start of their next turn
   * (same mechanism as `pendingExtraPlays`, but folded into `discardPlaysRemaining`).
   * No card grants this today, but the primitive mirrors `pendingExtraPlays` for
   * cross-turn discard-play grants.
   */
  pendingDiscardPlays: Record<PlayerId, number>;
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
  /**
   * Count of cards put into the discard pile during the current round (from any
   * zone). Reset to 0 at the start of each round. Drives "a card was put into the
   * discard pile this round" checks (Vulnerability #132).
   */
  discardedThisRound: number;
  /**
   * Colours nobody may play this round (Doubt #36). A play of a card whose printed
   * colour is in this list is rejected. Cleared/rotated at each round start from
   * `pendingBannedColors`.
   */
  bannedColors: Color[];
  /**
   * Colours to ban NEXT round, staged by a Doubt #36 played this round. Folded into
   * `bannedColors` (and cleared) when the next round begins, so the ban applies for
   * exactly the round after Doubt is played.
   */
  pendingBannedColors: Color[];
  /** Set once a player reaches 3 round wins. */
  winner: PlayerId | null;

  /** Deterministic RNG state (see rng.ts). */
  seed: number;
  uidCounter: number;
  log: LogEntry[];
}

export const ROUNDS_TO_WIN = 3;
export const STARTING_HAND = 5;
