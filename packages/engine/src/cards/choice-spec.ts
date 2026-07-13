// Per-card target specification. Describes, declaratively, what decisions a card
// needs so the UI can validate drop targets (drag-to-play) and drive a guided
// selection flow (manual play). This is UI metadata; the engine's card effects
// remain the source of truth for legality — a spec should describe the same
// targets the effect reads from `ctx.choices`.

import type { CardData, Color, GameState, Mood, PlayerId } from '../types.js';
import { allMoods, resolveCardNumber } from '../queries.js';

/** Which `choices` field a slot fills. */
export type ChoiceKey = 'moods' | 'players' | 'cards' | 'colors' | 'option';
export type TargetKind = 'mood' | 'player' | 'handCard' | 'color' | 'number' | 'choice';

/** Filter over moods in play (serializable). Values use current (stabilised) value. */
export interface MoodFilter {
  from?: 'own' | 'opponent' | 'any'; // relative to the acting player (default 'any')
  minValue?: number;
  maxValue?: number;
  colorIn?: Color[];
  hasSecondary?: boolean;
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
  players?: 'opponents' | 'all'; // kind === 'player'
  numberRange?: [number, number]; // kind === 'number'
  options?: string[]; // kind === 'choice' → sets `option`
}

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

/** The first slot that targets a board object (mood/player) — used by drag-to-play. */
export function firstBoardSlot(spec: ChoiceSpec): ChoiceSlot | undefined {
  return spec.slots.find((s) => s.kind === 'mood' || s.kind === 'player');
}

/** A single-target card: exactly one slot, targeting one board object. */
export function isSingleTarget(spec: ChoiceSpec): boolean {
  const board = spec.slots.filter((s) => s.kind === 'mood' || s.kind === 'player');
  return board.length === 1 && board[0]!.max === 1 && spec.slots.length === 1;
}

/** Look up static card data — the UI passes its CardDB-backed accessor. */
export type CardLookup = (cardNumber: number) => CardData;

/** Candidate targets for a slot, given the current board and acting player. */
export function legalTargets(
  slot: ChoiceSlot,
  state: GameState,
  actingPlayer: PlayerId,
  card: CardLookup
): { moods?: string[]; players?: PlayerId[]; cards?: number[]; colors?: Color[]; numbers?: number[]; options?: string[] } {
  switch (slot.kind) {
    case 'mood': {
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
        const data = card(resolveCardNumber(m));
        if (f.colorIn && !f.colorIn.includes(data.color)) return false;
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
      const hand = state.hands[actingPlayer] ?? [];
      const ok = hand.filter((n) => {
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
  const slot = spec.slots.find((s) => s.kind === targetKind);
  if (!slot) return false;
  const legal = legalTargets(slot, state, actingPlayer, card);
  return targetKind === 'mood' ? !!legal.moods?.includes(targetId) : !!legal.players?.includes(targetId);
}
