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

import { specFor, type Choices, type GameState, type PlayerId } from '@mood-swings/engine';

/**
 * Cards whose resolution requires a sub-choice from a seat OTHER than the active
 * player, per docs/card-notes.md (see docs/v2-multiplayer-spec.md §4). All of these
 * either let the affected player pick from their own hidden hand, or have every
 * player choose simultaneously:
 *
 *   67 Intimidation — chosen player reveals a card from their hand to give
 *   86 Compulsion   — victim picks a card from their hand to give
 *   31 Confusion    — each player simultaneously picks a hand card to pass
 *   78 Suspicion    — each chosen player simultaneously picks a discard
 *   68 Malice       — chosen player picks which two of their moods
 *   29 Avoidance    — each player simultaneously picks one of their moods to pass
 *
 * #67's ruling (docs/card-notes.md:724 "that player reveals a card from their hand"):
 * the CHOSEN player picks which card to reveal/give — not the active player. This
 * matches the card text and avoids ever exposing a hidden hand to the opponent.
 */
export const DELEGATED_CARDS: ReadonlySet<number> = new Set([67, 86, 31, 78, 68, 29]);

/**
 * Cards where every player chooses at the same time and no one may see another's
 * pick first. The host withholds engine.apply until ALL responses are in, so the
 * responses live only in host memory until the single atomic apply.
 */
export const SIMULTANEOUS_CARDS: ReadonlySet<number> = new Set([31, 78, 29]);

export function isDelegated(card: number): boolean {
  return DELEGATED_CARDS.has(card);
}

/**
 * How many things a SINGLE chooser picks for the delegated slot. Usually the slot's
 * own max, except Suspicion #78, whose slot max (8) is the hotseat pooled cap across
 * all chosen players — per chooser it is one card.
 */
export function maxPerChooser(card: number, slotMax: number): number {
  return card === 78 ? 1 : slotMax;
}

/**
 * The prompt shown to a delegated chooser. The card's own slot label is worded from
 * the ACTIVE player's point of view ("Choose a card from their hand"); the chooser is
 * picking from their OWN hand/moods, so give them a first-person prompt instead.
 */
export function delegatePrompt(card: number): string {
  switch (card) {
    case 67:
      return 'Reveal a card from your hand to give them';
    case 86:
      return 'Choose a card from your hand to give them';
    case 78:
      return 'Choose a card from your hand to discard';
    case 31:
      return 'Choose a card from your hand to pass';
    case 68:
      return 'Choose two of your moods';
    case 29:
      return 'Choose one of your moods to pass';
    default:
      return 'Make your choice';
  }
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

// --- Pure orchestration helpers (host-side). Unit-tested in net/delegation.test. ---

function moodsOf(state: GameState, pid: PlayerId): number {
  return (state.moods[pid] ?? []).length;
}
function handSize(state: GameState, pid: PlayerId): number {
  return (state.hands[pid] ?? []).length;
}

/** The delegated slot is always the LAST slot of a delegated card's spec. */
export function delegatedSlotIndex(card: number): number {
  const spec = specFor(card);
  return spec ? spec.slots.length - 1 : -1;
}

/**
 * Given the active player's assembled prior choices, which seats must each fill the
 * delegated (last) slot for themselves? Empty ⇒ no delegation is needed (the engine
 * would no-op or the active player already covered it), so the host can apply the
 * action as-is. More than one ⇒ a simultaneous collection (see SIMULTANEOUS_CARDS).
 */
export function computeChoosers(
  card: number,
  state: GameState,
  activeSeat: PlayerId,
  prior: Choices,
): PlayerId[] {
  const allWithMoods = () => state.players.map((p) => p.id).filter((p) => moodsOf(state, p) > 0);
  const allWithCards = () => state.players.map((p) => p.id).filter((p) => handSize(state, p) > 0);
  switch (card) {
    case 67:
    case 86: {
      // Intimidation / Compulsion — the chosen opponent picks a card from their own
      // hand to reveal+give. No choice needed if they hold none (engine no-ops).
      const v = prior.players?.[0];
      return v && v !== activeSeat && handSize(state, v) > 0 ? [v] : [];
    }
    case 68: {
      // Malice — the chosen 2+-mood player picks which two of their moods.
      const p = prior.players?.[0];
      return p && moodsOf(state, p) >= 2 ? [p] : [];
    }
    case 78:
      // Suspicion — each chosen player with cards discards one of their choice.
      return (prior.players ?? []).filter((p) => handSize(state, p) > 0);
    case 29:
      // Avoidance — every player with a mood passes one of their choice.
      return allWithMoods();
    case 31:
      // Confusion — every player with a card passes one of their choice.
      return allWithCards();
    default:
      return [];
  }
}

/**
 * The `priorChoices` to put in a chooser's request. For a `cardsFrom:'chosen'` slot,
 * scope `players` to just this chooser so their picker enumerates only THEIR OWN hand
 * (never the pooled set of chosen players' hands). Other slots pass prior through.
 */
export function scopedPriorForChooser(card: number, chooser: PlayerId, prior: Choices): Choices {
  const idx = delegatedSlotIndex(card);
  const slot = specFor(card)?.slots[idx];
  if (slot && slot.kind === 'handCard' && slot.cardsFrom === 'chosen') {
    return { ...prior, players: [chooser] };
  }
  return prior;
}

/**
 * Merge the active player's prior choices with every chooser's contributed slice into
 * the single pooled `Choices` the engine consumes. `players`/`option` come from prior
 * (the active player's picks); `moods`/`cards` are the union across all choosers.
 */
export function mergeResponses(prior: Choices, contributions: Choices[]): Choices {
  const merged: Choices = { ...prior };
  const cards = [...(prior.cards ?? [])];
  const moods = [...(prior.moods ?? [])];
  for (const c of contributions) {
    if (c.cards) cards.push(...c.cards);
    if (c.moods) moods.push(...c.moods);
  }
  if (cards.length) merged.cards = cards;
  if (moods.length) merged.moods = moods;
  return merged;
}
