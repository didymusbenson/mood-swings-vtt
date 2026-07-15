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
  /**
   * Which players' moods this slot enumerates, relative to the acting player
   * (default `'any'`):
   *   - `'own'`      — the acting player's moods.
   *   - `'opponent'` — every other player's moods.
   *   - `'chosen'`   — the moods of the player(s) picked in an EARLIER `players`
   *                    slot of this flow, for "choose player(s); one of THEIR moods
   *                    each" cards (Panic #48, Malice #68, and the per-player
   *                    return/discard cards #7/#28/#76/#101). Needs the `players`
   *                    slot first; offers nothing until a player is chosen, mirroring
   *                    `cardsFrom: 'chosen'` for hand slots.
   *   - `'any'`      — every mood in play.
   */
  from?: 'own' | 'opponent' | 'chosen' | 'any';
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
   * Gate this slot on the value chosen in an EARLIER `option` slot of the flow.
   * The slot is only presented when `choices.option` is one of these values; the
   * flow skips it otherwise. Used by "choose one" cards whose follow-up target
   * applies to only one branch — Corruption #60 ('cards' recovers discards, but
   * the 'wins' branch takes no cards), Guilt #14 / Hesitation #41 / Contempt #59
   * ('one' picks a mood, but 'all' takes none). A slot with no `showWhen` always
   * applies, so Avoidance #29 / Confusion #31 (whose pass slot applies to both
   * left and right) are unaffected.
   */
  showWhen?: { option: string[] };
  /**
   * kind === 'mood': this is an `afterPlaying` slot whose "choose a mood" may pick the
   * mood being played (it is already in play by then). The flow offers the played mood
   * as an extra candidate (SELF_TARGET) whenever it passes the slot's filter — checked
   * via `playedMoodQualifies` on the mood's would-be value (so Shock #101, worth [3]-,
   * can discard itself, while a value-buffed play can qualify for an odd/even/[5]+ slot).
   * For "each chosen player" cards the UI also requires the acting player to be chosen.
   * Set only on `afterPlaying` slots — never a cost slot (the mood isn't in play during a
   * cost) nor an "another mood" effect (those exclude the self by wording).
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

/**
 * Does a slot apply given the choices gathered so far in the flow? A slot with a
 * `showWhen` gate is only presented when the earlier `option` selection matches
 * (Corruption #60's discard-recovery slot is skipped on the double-win branch).
 * `option` is the value picked in the flow's `option` slot (null if not yet /
 * never chosen); it is compared as a string so numeric options still match.
 */
export function slotApplies(slot: ChoiceSlot, option: string | number | null): boolean {
  if (!slot.showWhen) return true;
  return option != null && slot.showWhen.option.includes(String(option));
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

/** Value-based part of a mood filter (min / max / parity) — shared by the in-play
 *  enumeration and the played-mood self-target check so they can't drift. */
function moodValuePasses(f: MoodFilter, value: number): boolean {
  if (f.minValue != null && value < f.minValue) return false;
  if (f.maxValue != null && value > f.maxValue) return false;
  if (f.valueParity === 'odd' && value % 2 !== 1) return false;
  if (f.valueParity === 'even' && value % 2 !== 0) return false;
  return true;
}

/**
 * Would the mood being played be a legal target for its own `selfTargetable` slot?
 * The played mood is always the acting player's own, so `from: 'opponent'` excludes
 * it; otherwise it must pass the same value / colour / secondary filter as any other
 * candidate. `value` is the mood's would-be (in-play) value. Colour uses the printed
 * colour (an Imagination override only exists once the mood is actually in play).
 */
export function playedMoodQualifies(slot: ChoiceSlot, data: CardData, value: number): boolean {
  const f = slot.mood ?? {};
  if (f.from === 'opponent') return false;
  if (!moodValuePasses(f, value)) return false;
  if (f.colorIn && !f.colorIn.includes(data.color)) return false;
  if (f.hasSecondary && !data.secondaryValue) return false;
  return true;
}

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
            : f.from === 'chosen'
              // Only the moods of the player(s) picked in the earlier `players` slot;
              // empty until one is chosen (Panic #48 must not offer other seats' moods).
              ? (ctx?.players ?? []).flatMap((pid) => state.moods[pid] ?? [])
              : allMoods(state);
      const ok = scope.filter((m) => {
        if (!moodValuePasses(f, m.currentValue)) return false;
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
