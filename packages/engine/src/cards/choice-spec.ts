// Per-card target specification. Describes, declaratively, what decisions a card
// needs so the UI can validate drop targets (drag-to-play) and drive a guided
// selection flow (manual play). This is UI metadata; the engine's card effects
// remain the source of truth for legality — a spec should describe the same
// targets the effect reads from `ctx.choices`.

import type { CardData, Color, GameState, Mood, PlayerId } from '../types.js';
import { allMoods, resolveCardNumber } from '../queries.js';

/** Which `choices` field a slot fills. */
export type ChoiceKey = 'moods' | 'players' | 'cards' | 'colors' | 'option' | 'copy';
/**
 * `copy` is a special board target (Creativity #32): the player clicks a mood in
 * play, but the slot records the CARD NUMBER of that mood into `choices.copy` (not a
 * uid into `choices.moods`), and the UI then walks the copied card's own spec.
 */
export type TargetKind = 'mood' | 'player' | 'handCard' | 'color' | 'number' | 'choice' | 'copy';

/** Filter over moods in play (serializable). Values use current (stabilised) value. */
export interface MoodFilter {
  from?: 'own' | 'opponent' | 'any'; // relative to the acting player (default 'any')
  minValue?: number;
  maxValue?: number;
  colorIn?: Color[];
  hasSecondary?: boolean;
  /** Only moods whose current value is odd (Anxiety #28) / even (Spite #76). */
  valueParity?: 'odd' | 'even';
  /**
   * Cap on the SUM of the current values of the moods selected together in this
   * slot (Anger #80: "total value [5] or less"). Not a per-candidate filter — it
   * constrains the combination, so the flow enforces it as moods are toggled.
   * legalTargets ignores it (every single mood is still individually offered).
   */
  maxTotalValue?: number;
}

/** Filter over the acting player's hand (serializable). */
export interface HandFilter {
  valueIn?: number[]; // printed top-right value
  colorIn?: Color[];
}

export interface ChoiceSlot {
  key: ChoiceKey;
  kind: TargetKind;
  /** Minimum selections required to confirm (0 ⇒ the slot is optional). */
  min: number;
  /** Maximum selections (1 ⇒ single-target). */
  max: number;
  label: string;
  /** "May" effect — the whole slot can be skipped even if candidates exist. */
  optional?: boolean;
  mood?: MoodFilter; // kind === 'mood'
  hand?: HandFilter; // kind === 'handCard'
  /**
   * Which pile a `handCard` slot enumerates (default `'acting'` — the hand of the
   * player playing the card):
   *   - `'chosen'`   — the union of the hands of the player(s) picked in an EARLIER
   *                    `players` slot of this flow, for "choose a player; that player
   *                    gives/discards a card from THEIR hand" cards (Compulsion #86,
   *                    Intimidation #67, Suspicion #78). Needs the `players` slot first.
   *   - `'discard'`  — the shared discard pile, for cards that recover/move a card
   *                    from the discard (Corruption #60, Cynicism #62, Nostalgia #128).
   */
  cardsFrom?: 'acting' | 'chosen' | 'discard';
  players?: 'opponents' | 'all'; // kind === 'player'
  numberRange?: [number, number]; // kind === 'number'
  options?: string[]; // kind === 'choice' → sets `option`
  /**
   * kind === 'mood': this is an `afterPlaying` slot whose "choose a mood" may pick the
   * mood being played (it is already in play by then). The flow offers the played mood
   * as an extra candidate (SELF_TARGET). Only set on slots whose filter the played mood
   * always satisfies (e.g. `from: 'any'` with no value/colour constraint) — never on a
   * cost slot (the mood is not yet in play during a cost) or an "another mood" effect.
   */
  selfTargetable?: boolean;
}

/**
 * Sentinel `moods` value meaning "the mood being played". A mood is in play the
 * instant it is played, so its own `afterPlaying — choose a mood` effect may target
 * it (Conviction #6, Scorn #24, Hate #66, Faith #12). The player picks it before the
 * mood has a real uid, so the flow records this sentinel; the engine swaps it for the
 * played mood's uid once it enters play (before afterPlaying runs).
 */
export const SELF_TARGET = '@self';

export interface ChoiceSpec {
  slots: ChoiceSlot[];
}

const specByNumber = new Map<number, ChoiceSpec>();

export function registerSpec(cardNumber: number, spec: ChoiceSpec): void {
  specByNumber.set(cardNumber, spec);
}

export function specFor(cardNumber: number): ChoiceSpec | undefined {
  return specByNumber.get(cardNumber);
}

/** True if the card offers no interactive targets (just play it). */
export function playsImmediately(cardNumber: number): boolean {
  const spec = specByNumber.get(cardNumber);
  return !spec || spec.slots.length === 0;
}

/** True if the card must have targets chosen before it can resolve meaningfully. */
export function hasRequiredTargets(cardNumber: number): boolean {
  const spec = specByNumber.get(cardNumber);
  return !!spec && spec.slots.some((s) => s.min > 0);
}

/** The first slot that targets a board object (mood/copy/player) — used by drag-to-play. */
export function firstBoardSlot(spec: ChoiceSpec): ChoiceSlot | undefined {
  return spec.slots.find((s) => s.kind === 'mood' || s.kind === 'player' || s.kind === 'copy');
}

/** A single-target card: exactly one slot, targeting one board object. */
export function isSingleTarget(spec: ChoiceSpec): boolean {
  const board = spec.slots.filter((s) => s.kind === 'mood' || s.kind === 'player');
  return board.length === 1 && board[0]!.max === 1 && spec.slots.length === 1;
}

/** Look up static card data — the UI passes its CardDB-backed accessor. */
export type CardLookup = (cardNumber: number) => CardData;

/**
 * Selections already gathered earlier in the current flow. Only the fields a
 * later slot can depend on are needed (e.g. a `handFrom: 'chosen'` card slot
 * reads the players picked in an earlier `players` slot).
 */
export interface SlotContext {
  players?: PlayerId[];
}

/** Candidate targets for a slot, given the current board and acting player. */
export function legalTargets(
  slot: ChoiceSlot,
  state: GameState,
  actingPlayer: PlayerId,
  card: CardLookup,
  ctx?: SlotContext
): { moods?: string[]; players?: PlayerId[]; cards?: number[]; colors?: Color[]; numbers?: number[]; options?: string[] } {
  switch (slot.kind) {
    case 'mood':
    case 'copy': {
      // 'copy' presents the same in-play moods as a mood slot (the player clicks a
      // mood to copy); the UI translates the chosen mood to a card number.
      const f = slot.mood ?? {};
      const scope: Mood[] =
        f.from === 'own'
          ? state.moods[actingPlayer] ?? []
          : f.from === 'opponent'
            ? state.players.filter((p) => p.id !== actingPlayer).flatMap((p) => state.moods[p.id] ?? [])
            : allMoods(state);
      const ok = scope.filter((m) => {
        if (f.minValue != null && m.currentValue < f.minValue) return false;
        if (f.maxValue != null && m.currentValue > f.maxValue) return false;
        if (f.valueParity === 'odd' && m.currentValue % 2 !== 1) return false;
        if (f.valueParity === 'even' && m.currentValue % 2 !== 0) return false;
        const data = card(resolveCardNumber(m));
        // Honour an active colour override (Imagination) for in-play colour filters.
        if (f.colorIn && !f.colorIn.includes(m.colorOverride ?? data.color)) return false;
        if (f.hasSecondary && !data.secondaryValue) return false;
        return true;
      });
      return { moods: ok.map((m) => m.uid) };
    }
    case 'player': {
      const ids = state.players.map((p) => p.id);
      return { players: slot.players === 'opponents' ? ids.filter((id) => id !== actingPlayer) : ids };
    }
    case 'handCard': {
      const f = slot.hand ?? {};
      // Resolve the source pile:
      //   'discard' → the shared discard pile (Corruption #60, Cynicism #62, Nostalgia #128);
      //   'chosen'  → the union of the hands of the player(s) picked in an earlier slot
      //               (Suspicion #78 union; Compulsion #86 / Intimidation #67 single);
      //   'acting'  → the acting player's own hand (default).
      const pool: number[] =
        slot.cardsFrom === 'discard'
          ? state.discard ?? []
          : (slot.cardsFrom === 'chosen' ? ctx?.players ?? [] : [actingPlayer]).flatMap(
              (owner) => state.hands[owner] ?? [],
            );
      const ok = pool.filter((n) => {
        const data = card(n);
        if (f.valueIn && !f.valueIn.includes(data.value)) return false;
        if (f.colorIn && !f.colorIn.includes(data.color)) return false;
        return true;
      });
      return { cards: ok };
    }
    case 'color':
      return { colors: (['white', 'blue', 'black', 'red', 'green'] as Color[]) };
    case 'number': {
      const [lo, hi] = slot.numberRange ?? [0, 12];
      return { numbers: Array.from({ length: hi - lo + 1 }, (_, i) => lo + i) };
    }
    case 'choice':
      return { options: slot.options ?? [] };
  }
}

/** Is `target` a legal drop target (mood uid or player id) for the card's first board slot? */
export function isLegalDrop(
  cardNumber: number,
  targetId: string,
  targetKind: 'mood' | 'player',
  state: GameState,
  actingPlayer: PlayerId,
  card: CardLookup
): boolean {
  const spec = specByNumber.get(cardNumber);
  if (!spec) return false;
  // A mood drop also satisfies a 'copy' slot (Creativity: drop onto the mood to copy).
  const slot = spec.slots.find((s) =>
    targetKind === 'mood' ? s.kind === 'mood' || s.kind === 'copy' : s.kind === 'player',
  );
  if (!slot) return false;
  const legal = legalTargets(slot, state, actingPlayer, card);
  return targetKind === 'mood' ? !!legal.moods?.includes(targetId) : !!legal.players?.includes(targetId);
}
