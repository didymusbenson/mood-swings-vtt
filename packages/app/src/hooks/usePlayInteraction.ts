// Drives both play modes for the hotseat board:
//
//   MODE 1 (manual): click a hand card to *select* it, then press Play. Cards
//   that need targets open a guided slot-walking flow (Confirm / Skip / Cancel).
//
//   MODE 2 (drag): drag a hand card onto the field (general play) or onto a
//   specific mood / player panel. A legal single-target drop plays immediately;
//   a legal multi-slot drop opens the flow with that target pre-selected.
//
// All target legality comes from the engine's per-card spec metadata
// (specFor / legalTargets / isLegalDrop / …) — never from parsing rules text.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Action, Choices, GameState } from '@mood-swings/engine';
import {
  specFor,
  legalTargets,
  isLegalDrop,
  playsImmediately,
  isSingleTarget,
  firstBoardSlot,
  playedMoodQualifies,
  slotApplies,
  queries,
  SELF_TARGET,
  type ChoiceSlot,
  type ChoiceSpec,
} from '@mood-swings/engine';
import { db } from '../game/db.js';
import { handWouldBe } from '../game/value.js';
import { isDelegated } from '../net/delegation.js';

export type PlayMode = 'manual' | 'drag';

const cardLookup = (n: number) => db.get(n);

/** Mutable selections gathered while walking a card's spec. */
interface Selections {
  moods: string[];
  players: string[];
  cards: number[];
  /**
   * The indices into the current `handCard` slot's enumerated candidate list
   * (`legalNow.cards`) that are selected. Kept in lockstep with `cards` (the resolved
   * collector numbers) so two identical copies in one zone are independently selectable
   * (F-5) — `cards` alone can't distinguish duplicate numbers. UI-only; never dispatched.
   */
  cardIdx: number[];
  colors: string[];
  option: string | number | null;
  /** Creativity #32: the card number being copied (from the chosen mood). */
  copy: number | null;
  /** The uid of the copied mood, kept only to highlight it in the picker. */
  copyUid: string | null;
}

const emptySelections = (): Selections => ({
  moods: [], players: [], cards: [], cardIdx: [], colors: [], option: null, copy: null, copyUid: null,
});

/** Current (stabilised) value of an in-play mood by uid — 0 if not found. */
function moodValue(state: GameState, uid: string): number {
  for (const p of state.players) {
    const m = (state.moods[p.id] ?? []).find((x) => x.uid === uid);
    if (m) return m.currentValue;
  }
  return 0;
}

/** The card number a mood in play currently represents (copies resolve to their source). */
function copyCardOf(state: GameState, uid: string): number | null {
  for (const p of state.players) {
    const m = (state.moods[p.id] ?? []).find((x) => x.uid === uid);
    if (m) return m.copyOf ?? m.card;
  }
  return null;
}

interface Flow {
  card: number;
  spec: ChoiceSpec;
  slotIndex: number;
  sel: Selections;
  /** Zone the card is played from — the discard pile for a Grief/Melancholy-style play. */
  from?: 'hand' | 'discard';
}

/** Where a drag can currently be dropped (for highlight/dim affordances). */
export interface DragTargets {
  card: number;
  spec: ChoiceSpec | undefined;
  boardSlot: ChoiceSlot | undefined;
}

export interface PlayController {
  mode: PlayMode;
  setMode: (m: PlayMode) => void;

  /** Active player may act right now (their turn, awaiting a play). */
  canAct: boolean;
  /** Can the player spend a play on a HAND card right now? False when the only remaining
   *  budget is discard-only (Grief/Angst/Harmony/Grace) — the hand is then dimmed (F-1). */
  canPlayHand: boolean;
  me: string;

  // ----- Manual selection (pre-play) -----
  selectedCard: number | null;
  isSelected: (card: number) => boolean;
  selectCard: (card: number) => void;
  play: () => void; // play the selected card
  onPass: () => void; // end the active player's turn

  // ----- Targeting flow (shared by both modes) -----
  flow: Flow | null;
  slotPrompt: string | null;
  slotProgress: { count: number; min: number; max: number } | null;
  currentSlot: ChoiceSlot | null;
  legalNow: ReturnType<typeof legalTargets> | null;
  canConfirm: boolean;
  canSkip: boolean;
  confirm: () => void;
  skip: () => void;
  cancel: () => void;
  // in-panel controls for color / number / choice slots:
  setOption: (value: string | number) => void;
  toggleColor: (value: string) => void;

  // ----- Board target interactions -----
  moodHighlighted: (uid: string) => boolean;
  moodSelected: (uid: string) => boolean;
  onMoodClick: (uid: string) => void;
  playerHighlighted: (pid: string) => boolean;
  playerSelected: (pid: string) => boolean;
  onPlayerClick: (pid: string) => void;
  /** Is this rendered hand card (owned by `owner`) a legal target for the current slot? Zone-scoped (F-3). */
  handCardHighlighted: (card: number, owner: string) => boolean;
  /** Is the overlay-fan candidate at `index` (into `legalNow.cards`) selected? Index-keyed (F-5). */
  handCardSelected: (index: number) => boolean;
  /** In a `handCard` flow, toggle the candidate at `index`; outside a flow (no index), tap-to-select. */
  onHandCardClick: (card: number, index?: number) => void;

  // ----- Drag & drop (pointer-driven; see useHandDrag) -----
  dragCard: number | null;
  /** Arm drag affordances (highlight legal targets, dim the rest). */
  beginDrag: (card: number) => void;
  /** Clear the drag with no play (snap back). */
  endDrag: () => void;
  /** Discard-pile cards the player may play right now (Grief/Melancholy/etc.). */
  legalDiscardCards: number[];
  /** Start a play sourced from the discard pile (immediate, or open the flow). */
  beginDiscardPlay: (card: number) => void;
  /** Play with no specific target: immediate, or open the flow at slot 0. */
  playToField: (card: number) => void;
  /** Play onto a specific mood (single-target immediate, else flow pre-selected). */
  playToMood: (card: number, uid: string) => void;
  /** Play onto a specific player panel. */
  playToPlayer: (card: number, pid: string) => void;
  /** While dragging: is this board object a legal drop for the *current* drag? */
  dragLegalMood: (uid: string) => boolean;
  dragLegalPlayer: (pid: string) => boolean;
  /** Card-explicit legality (independent of async dragCard state). */
  canDropMood: (card: number, uid: string) => boolean;
  canDropPlayer: (card: number, pid: string) => boolean;
}

function countForSlot(slot: ChoiceSlot, sel: Selections): number {
  switch (slot.key) {
    case 'moods':
      return sel.moods.length;
    case 'players':
      return sel.players.length;
    case 'cards':
      return sel.cards.length;
    case 'colors':
      return sel.colors.length;
    case 'option':
      return sel.option != null ? 1 : 0;
    case 'copy':
      return sel.copy != null ? 1 : 0;
  }
}

function assembleChoices(sel: Selections): Choices {
  const choices: Choices = {};
  if (sel.moods.length) choices.moods = sel.moods;
  if (sel.players.length) choices.players = sel.players;
  if (sel.cards.length) choices.cards = sel.cards;
  if (sel.colors.length) choices.colors = sel.colors;
  if (sel.option != null) choices.option = sel.option;
  if (sel.copy != null) choices.copy = sel.copy;
  return choices;
}

/** Toggle a value in a bounded selection list (single-max slots replace). */
export function toggleBounded<T>(list: T[], value: T, max: number): T[] {
  if (list.includes(value)) return list.filter((v) => v !== value);
  if (list.length < max) return [...list, value];
  if (max === 1) return [value];
  return list; // at capacity for a multi-select — ignore extra clicks
}

/**
 * A "pooled, one-per-chosen-player" target slot: a `mood`/`handCard` slot sourced from
 * the player(s) picked in an earlier `players` slot (Suspicion #78, Spite #76, Panic #48,
 * Foresight #7, Anxiety #28, Shock #101, Malice #68). Its `max` is the POOLED cap across
 * all chosen players, not a per-selection bound.
 */
export function isChosenPooledSlot(slot: ChoiceSlot): boolean {
  return (
    (slot.kind === 'handCard' && slot.cardsFrom === 'chosen') ||
    (slot.kind === 'mood' && slot.mood?.from === 'chosen')
  );
}

/**
 * The effective selection cap for a slot (F-6). A pooled "one per chosen player" slot is
 * capped at the number of chosen players (`min(slot.max, #chosen)`), so the picker can't
 * over-select past what the effect consumes. Only applies when the preceding `players`
 * slot is genuinely multi (`max > 1`) — this GUARDS Malice #68, a real "choose two" from a
 * SINGLE chosen player (its players slot is `max:1`), whose `max:2` must stand. Every other
 * slot keeps its declared `max`.
 */
export function pooledMax(slot: ChoiceSlot, spec: ChoiceSpec, chosenPlayers: number): number {
  const multiPlayerFlow = spec.slots.some((s) => s.kind === 'player' && s.max > 1);
  if (isChosenPooledSlot(slot) && multiPlayerFlow) {
    return Math.min(slot.max, Math.max(1, chosenPlayers));
  }
  return slot.max;
}

/**
 * A slot whose choice is FORCED — the flow must not let the player "skip" past it as if
 * opting out, and (when there is a single legal candidate) may pre-select it. Two cases:
 *   - genuinely mandatory (`min > 0`, not `optional`); or
 *   - a pooled `from:'chosen'` follow-up once at least one player is chosen — the effect is
 *     committed to fire for each chosen player, so its `min:0` is only "the engine may pick
 *     for you", never "no effect" (F-7a).
 */
export function isForcedSlot(slot: ChoiceSlot, chosenPlayers: number): boolean {
  const mandatory = slot.min > 0 && !slot.optional;
  const forcedChosen = isChosenPooledSlot(slot) && chosenPlayers > 0;
  return mandatory || forcedChosen;
}

/** The candidate list for the current slot's kind (null for non-target slots). */
function slotCandidates(
  slot: ChoiceSlot,
  legal: ReturnType<typeof legalTargets> | null,
): string[] | number[] | null {
  if (slot.kind === 'mood' || slot.kind === 'copy') return legal?.moods ?? null;
  if (slot.kind === 'player') return legal?.players ?? null;
  if (slot.kind === 'handCard') return legal?.cards ?? null;
  return null; // color / number / choice always have selectable options
}

export function usePlayInteraction(
  state: GameState,
  onAction: (a: Action) => void,
  localSeat: string,
  opts: { delegate?: boolean } = {},
): PlayController {
  const delegate = opts.delegate ?? false;
  const [mode, setMode] = useState<PlayMode>('manual');
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [dragCard, setDragCard] = useState<number | null>(null);

  // `me` is the seat THIS client controls — not necessarily the active seat. In
  // Goldfish the caller passes `localSeat = state.activePlayer` (one driver plays
  // whoever's turn it is), reproducing the old behaviour. In a networked game each
  // client passes its own fixed seat, so a player can only ever act as themselves,
  // and only on their own turn.
  const me = localSeat;
  const canAct = state.phase === 'awaitingPlay' && state.activePlayer === localSeat;

  // Any dispatched action produces a fresh state object — reset transient
  // interaction so a resolved play doesn't leave stale selections behind.
  useEffect(() => {
    setSelectedCard(null);
    setFlow(null);
    setDragCard(null);
  }, [state]);

  const currentSlot = flow ? flow.spec.slots[flow.slotIndex] ?? null : null;

  const legalNow = useMemo(() => {
    if (!flow || !currentSlot) return null;
    // Pass the players already chosen this flow so a `cardsFrom: 'chosen'` card slot
    // enumerates the CHOSEN player's hand (Compulsion #86 etc.), not the acting one.
    const legal = legalTargets(currentSlot, state, me, cardLookup, { players: flow.sel.players });
    // The card being played is a mood-to-be, not a hand card — never offer it as a
    // hand-cost discard/reveal (matters when copying a discard-cost card via Creativity).
    if (currentSlot.kind === 'handCard' && legal.cards) {
      return { ...legal, cards: legal.cards.filter((c) => c !== flow.card) };
    }
    // A `selfTargetable` mood slot may pick the mood being played (it's in play by the
    // time the afterPlaying effect resolves). Offer it up front when the played mood
    // would pass the slot's filter, and — for "each chosen player" cards (a preceding
    // players slot) — only when the acting player is one of the chosen. The SELF_TARGET
    // sentinel resolves to the real uid engine-side.
    if (currentSlot.kind === 'mood' && currentSlot.selfTargetable) {
      const hasPlayerSlot = flow.spec.slots.some((sl) => sl.kind === 'player');
      const iAmChosen = !hasPlayerSlot || flow.sel.players.includes(me);
      const wb = handWouldBe(state, me, flow.card);
      const value = wb.value ?? wb.printed;
      if (iAmChosen && playedMoodQualifies(currentSlot, cardLookup(flow.card), value)) {
        return { ...legal, moods: [SELF_TARGET, ...(legal.moods ?? [])] };
      }
    }
    return legal;
  }, [flow, currentSlot, state, me]);

  // --- Begin a play (either immediately or by opening the targeting flow) ---
  const beginPlay = useCallback(
    (card: number, preselect?: { key: ChoiceSlot['key']; value: string }, from: 'hand' | 'discard' = 'hand') => {
      if (playsImmediately(card)) {
        onAction({ type: 'play', player: me, card, ...(from === 'discard' ? { from } : {}) });
        return;
      }
      const spec = specFor(card)!;
      const sel = emptySelections();
      if (preselect) {
        if (preselect.key === 'moods') sel.moods = [preselect.value];
        else if (preselect.key === 'players') sel.players = [preselect.value];
        else if (preselect.key === 'copy') {
          sel.copyUid = preselect.value;
          sel.copy = copyCardOf(state, preselect.value);
        }
      }
      setFlow({ card, spec, slotIndex: 0, sel, from });
      setSelectedCard(null);
    },
    [me, onAction, state],
  );

  const play = useCallback(() => {
    if (selectedCard == null) return;
    beginPlay(selectedCard);
  }, [selectedCard, beginPlay]);

  // Which discard-pile cards can be played from the discard right now (Grief/Angst/
  // Harmony grants, Melancholy permission, Grace colour-grant) — the source of truth
  // for the discard inspector's play affordance. The engine still validates on dispatch.
  const legalDiscardCards = useMemo(
    () => (canAct && !flow ? queries.legalDiscardPlays(state, me, db) : []),
    [canAct, flow, state, me],
  );
  // Whether a HAND card can be played right now — false when the only remaining budget is
  // discard-only (Grief/Angst/Harmony/Grace). Gates the begin-play entry points below and
  // dims the hand in the board, so a discard-only play can't walk the hand-card flow only to
  // be rejected at dispatch (F-1).
  const canPlayHand = useMemo(
    () => canAct && !flow && queries.canPlayFromHand(state, me),
    [canAct, flow, state, me],
  );
  const beginDiscardPlay = useCallback(
    (card: number) => {
      if (!canAct || flow) return;
      if (!legalDiscardCards.includes(card)) return;
      beginPlay(card, undefined, 'discard');
    },
    [canAct, flow, legalDiscardCards, beginPlay],
  );

  const onPass = useCallback(() => {
    onAction({ type: 'pass', player: me });
  }, [onAction, me]);

  // --- Flow controls ---
  const finishOrAdvance = useCallback(
    (f: Flow) => {
      // After a Creativity copy slot resolves, splice the copied card's OWN spec in
      // right after it so the flow then walks the copied card's targets.
      let spec = f.spec;
      if (f.spec.slots[f.slotIndex]?.kind === 'copy') {
        const copied = f.sel.copy != null ? specFor(f.sel.copy)?.slots ?? [] : [];
        spec = { slots: [...f.spec.slots.slice(0, f.slotIndex + 1), ...copied] };
      }
      // Advance to the next slot that applies. Slots gated on an earlier `option`
      // choice (Corruption #60's discard-recovery slot) are skipped when their
      // branch wasn't chosen — so picking the double-win never prompts for cards.
      let next = f.slotIndex + 1;
      while (next < spec.slots.length && !slotApplies(spec.slots[next]!, f.sel.option)) next++;
      // In a networked game the last slot of a delegated card belongs to the OTHER
      // seat(s); the active player stops one slot early and submits a partial action,
      // and the host collects the delegated slot from the right player(s).
      const lastForMe = delegate && isDelegated(f.card) ? spec.slots.length - 2 : spec.slots.length - 1;
      if (next > lastForMe) {
        onAction({
          type: 'play',
          player: me,
          card: f.card,
          choices: assembleChoices(f.sel),
          ...(f.from === 'discard' ? { from: f.from } : {}),
        });
        setFlow(null);
      } else {
        setFlow({ ...f, spec, slotIndex: next });
      }
    },
    [me, onAction, delegate],
  );

  // Auto-resolve a slot that offers no real decision, so a forced choice never soft-locks and
  // a one-option pick isn't busywork. Runs whenever the current slot / its legal candidates
  // change; `autoRef` keys each (card, slotIndex) so it acts at most once per slot entry
  // (letting the player freely de-select an auto-picked target afterwards):
  //   - a FORCED slot (mandatory `min>0`, or a committed `from:'chosen'` follow-up) with an
  //     EMPTY candidate set auto-advances — treated as satisfied with no selection. This
  //     preserves "mandatory WHEN ABLE": Malice #68 with no 2+-mood player, Betrayal #56 with
  //     no own mood, Guile #40 with no opponent mood, or a chosen player with no qualifying
  //     mood/card, all advance instead of trapping the flow (the engine no-ops on empty).
  //   - a forced slot with EXACTLY ONE candidate pre-selects it (F-7a): Spite #76 targeting a
  //     player with a single even mood, or a single-opponent player slot, is already picked.
  const autoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!flow || !currentSlot || !legalNow) {
      autoRef.current = null;
      return;
    }
    const cands = slotCandidates(currentSlot, legalNow);
    if (!cands) return; // color / number / choice always resolvable — never auto-stepped
    if (!isForcedSlot(currentSlot, flow.sel.players.length)) return;
    const key = `${flow.card}:${flow.slotIndex}`;
    if (autoRef.current === key) return;

    if (cands.length === 0) {
      autoRef.current = key;
      finishOrAdvance(flow);
      return;
    }
    if (cands.length === 1) {
      autoRef.current = key;
      const only = cands[0]!;
      setFlow((f) => {
        if (!f) return f;
        if (currentSlot.kind === 'handCard') {
          if (f.sel.cardIdx.length > 0) return f;
          return { ...f, sel: { ...f.sel, cardIdx: [0], cards: [only as number] } };
        }
        // mood / copy / player all record a uid/id string
        if (f.sel.moods.includes(only as string) || f.sel.players.includes(only as string)) return f;
        if (currentSlot.kind === 'player') return { ...f, sel: { ...f.sel, players: [only as string] } };
        return { ...f, sel: { ...f.sel, moods: [only as string] } };
      });
    }
  }, [flow, currentSlot, legalNow, finishOrAdvance]);

  const confirm = useCallback(() => {
    if (!flow || !currentSlot) return;
    if (countForSlot(currentSlot, flow.sel) < currentSlot.min) return;
    finishOrAdvance(flow);
  }, [flow, currentSlot, finishOrAdvance]);

  const skip = useCallback(() => {
    if (!flow || !currentSlot) return;
    // Clear this slot's provisional selections, then advance.
    const sel: Selections = { ...flow.sel };
    if (currentSlot.key === 'moods') sel.moods = [];
    else if (currentSlot.key === 'players') sel.players = [];
    else if (currentSlot.key === 'cards') { sel.cards = []; sel.cardIdx = []; }
    else if (currentSlot.key === 'colors') sel.colors = [];
    else if (currentSlot.key === 'option') sel.option = null;
    else if (currentSlot.key === 'copy') { sel.copy = null; sel.copyUid = null; }
    finishOrAdvance({ ...flow, sel });
  }, [flow, currentSlot, finishOrAdvance]);

  const cancel = useCallback(() => setFlow(null), []);

  const setOption = useCallback(
    (value: string | number) => {
      setFlow((f) => (f ? { ...f, sel: { ...f.sel, option: f.sel.option === value ? null : value } } : f));
    },
    [],
  );

  const toggleColor = useCallback(
    (value: string) => {
      setFlow((f) => {
        if (!f) return f;
        const slot = f.spec.slots[f.slotIndex];
        return { ...f, sel: { ...f.sel, colors: toggleBounded(f.sel.colors, value, slot?.max ?? 5) } };
      });
    },
    [],
  );

  // --- Manual card selection ---
  const isSelected = useCallback(
    (card: number) => selectedCard === card,
    [selectedCard],
  );
  const selectCard = useCallback(
    (card: number) => {
      if (!canAct || flow || !canPlayHand) return; // discard-only budget → hand not selectable (F-1)
      setSelectedCard((cur) => (cur === card ? null : card));
    },
    [canAct, flow, canPlayHand],
  );

  // --- Board target clicks (only meaningful inside the flow) ---
  const onMoodClick = useCallback(
    (uid: string) => {
      if (!flow || !currentSlot) return;
      if (!legalNow?.moods?.includes(uid)) return;
      if (currentSlot.kind === 'copy') {
        // Clicking a mood picks WHAT Creativity copies (its card number).
        const copy = copyCardOf(state, uid);
        setFlow((f) => (f ? { ...f, sel: { ...f.sel, copy, copyUid: uid } } : f));
        return;
      }
      if (currentSlot.kind !== 'mood') return;
      // Running-total cap (Anger #80): block a pick that would push the selected moods'
      // combined value over the limit (deselecting is always allowed).
      const cap = currentSlot.mood?.maxTotalValue;
      if (cap != null && !flow.sel.moods.includes(uid)) {
        const total = flow.sel.moods.reduce((s, u) => s + moodValue(state, u), 0);
        if (total + moodValue(state, uid) > cap) return;
      }
      setFlow((f) =>
        f
          ? { ...f, sel: { ...f.sel, moods: toggleBounded(f.sel.moods, uid, pooledMax(currentSlot, f.spec, f.sel.players.length)) } }
          : f,
      );
    },
    [flow, currentSlot, legalNow, state],
  );

  const onPlayerClick = useCallback(
    (pid: string) => {
      if (!flow || !currentSlot || currentSlot.kind !== 'player') return;
      if (!legalNow?.players?.includes(pid)) return;
      setFlow((f) => (f ? { ...f, sel: { ...f.sel, players: toggleBounded(f.sel.players, pid, currentSlot.max) } } : f));
    },
    [flow, currentSlot, legalNow],
  );

  const onHandCardClick = useCallback(
    (card: number, index?: number) => {
      if (flow && currentSlot && currentSlot.kind === 'handCard') {
        // Select by INDEX into the enumerated candidate list, not by collector number, so two
        // identical copies in one zone are independently selectable (F-5). `cards` (the resolved
        // numbers that get dispatched) is kept in lockstep with `cardIdx`.
        const cands = legalNow?.cards ?? [];
        if (index == null || index < 0 || index >= cands.length) return;
        setFlow((f) => {
          if (!f) return f;
          const max = pooledMax(currentSlot, f.spec, f.sel.players.length);
          const nextIdx = toggleBounded(f.sel.cardIdx, index, max);
          const nextCards = nextIdx.map((j) => cands[j]!);
          return { ...f, sel: { ...f.sel, cardIdx: nextIdx, cards: nextCards } };
        });
        return;
      }
      selectCard(card);
    },
    [flow, currentSlot, legalNow, selectCard],
  );

  const moodHighlighted = useCallback(
    (uid: string) => {
      if (dragCard != null) return dragLegalMoodImpl(dragCard, uid, state, me);
      const kind = currentSlot?.kind;
      return !!(flow && (kind === 'mood' || kind === 'copy') && legalNow?.moods?.includes(uid));
    },
    [dragCard, flow, currentSlot, legalNow, state, me],
  );
  const moodSelected = useCallback(
    (uid: string) => !!flow?.sel.moods.includes(uid) || flow?.sel.copyUid === uid,
    [flow],
  );

  const playerHighlighted = useCallback(
    (pid: string) => {
      if (dragCard != null) return dragLegalPlayerImpl(dragCard, pid, state, me);
      return !!(flow && currentSlot?.kind === 'player' && legalNow?.players?.includes(pid));
    },
    [dragCard, flow, currentSlot, legalNow, state, me],
  );
  const playerSelected = useCallback((pid: string) => !!flow?.sel.players.includes(pid), [flow]);

  // A rendered hand card (owned by `owner`) is a legal `handCard` target only when the
  // current slot's SOURCE PILE is that hand — otherwise a same-numbered copy in another zone
  // must not light up (F-3). Discard-sourced slots live only in the overlay fan, never a hand.
  const handCardHighlighted = useCallback(
    (card: number, owner: string) => {
      if (!flow || currentSlot?.kind !== 'handCard') return false;
      if (!legalNow?.cards?.includes(card)) return false;
      const from = currentSlot.cardsFrom ?? 'acting';
      if (from === 'discard') return false;
      if (from === 'chosen') return flow.sel.players.includes(owner);
      return owner === me; // 'acting'
    },
    [flow, currentSlot, legalNow, me],
  );
  // Selection is keyed by candidate INDEX (into `legalNow.cards`), owned by the overlay fan
  // (the single source of truth for handCard picks — F-5), so duplicate numbers stay distinct.
  const handCardSelected = useCallback((index: number) => !!flow?.sel.cardIdx.includes(index), [flow]);

  // --- Drag & drop ---
  const beginDrag = useCallback(
    (card: number) => {
      if (!canAct || flow || !canPlayHand) return; // discard-only budget → hand not draggable (F-1)
      setSelectedCard(null);
      setDragCard(card);
    },
    [canAct, flow, canPlayHand],
  );
  const endDrag = useCallback(() => setDragCard(null), []);

  // Drop resolvers take the card explicitly (not the async `dragCard` state) so
  // the pointer hook's captured closure resolves the drop even mid-render.
  const playToField = useCallback(
    (card: number) => {
      setDragCard(null);
      if (!queries.canPlayFromHand(state, me)) return; // discard-only budget → no hand play (F-1)
      beginPlay(card); // no specific target → immediate or open flow at slot 0
    },
    [beginPlay, state, me],
  );

  const playToMood = useCallback(
    (card: number, uid: string) => {
      setDragCard(null);
      if (!queries.canPlayFromHand(state, me)) return; // discard-only budget → no hand play (F-1)
      if (!isLegalDrop(card, uid, 'mood', state, me, cardLookup)) return; // snap back
      const spec = specFor(card)!;
      if (isSingleTarget(spec)) {
        onAction({ type: 'play', player: me, card, choices: { moods: [uid] } });
      } else {
        // Creativity's first board slot is a 'copy' slot — the dropped mood is what to copy.
        const key = firstBoardSlot(spec)?.kind === 'copy' ? 'copy' : 'moods';
        beginPlay(card, { key, value: uid });
      }
    },
    [state, me, onAction, beginPlay],
  );

  const playToPlayer = useCallback(
    (card: number, pid: string) => {
      setDragCard(null);
      if (!queries.canPlayFromHand(state, me)) return; // discard-only budget → no hand play (F-1)
      if (!isLegalDrop(card, pid, 'player', state, me, cardLookup)) return; // snap back
      const spec = specFor(card)!;
      if (isSingleTarget(spec)) {
        onAction({ type: 'play', player: me, card, choices: { players: [pid] } });
      } else {
        beginPlay(card, { key: 'players', value: pid });
      }
    },
    [state, me, onAction, beginPlay],
  );

  const canDropMood = useCallback(
    (card: number, uid: string) => dragLegalMoodImpl(card, uid, state, me),
    [state, me],
  );
  const canDropPlayer = useCallback(
    (card: number, pid: string) => dragLegalPlayerImpl(card, pid, state, me),
    [state, me],
  );

  const dragLegalMood = useCallback(
    (uid: string) => (dragCard != null ? dragLegalMoodImpl(dragCard, uid, state, me) : false),
    [dragCard, state, me],
  );
  const dragLegalPlayer = useCallback(
    (pid: string) => (dragCard != null ? dragLegalPlayerImpl(dragCard, pid, state, me) : false),
    [dragCard, state, me],
  );

  const slotProgress = flow && currentSlot
    ? { count: countForSlot(currentSlot, flow.sel), min: currentSlot.min, max: pooledMax(currentSlot, flow.spec, flow.sel.players.length) }
    : null;
  const canConfirm = !!(flow && currentSlot && countForSlot(currentSlot, flow.sel) >= currentSlot.min);
  // Skip is offered only when the slot is a genuine "may" opt-out. A forced follow-up slot
  // (a `from:'chosen'` mood/handCard with players already chosen) is committed to fire per
  // chosen player — skipping it would misleadingly read as "no effect", so suppress it (F-7a).
  const canSkip = !!(
    flow &&
    currentSlot &&
    (currentSlot.optional || currentSlot.min === 0) &&
    !isForcedSlot(currentSlot, flow.sel.players.length)
  );

  return {
    mode,
    setMode,
    canAct,
    canPlayHand,
    me,
    selectedCard,
    isSelected,
    selectCard,
    play,
    onPass,
    flow,
    slotPrompt: currentSlot?.label ?? null,
    slotProgress,
    currentSlot,
    legalNow,
    canConfirm,
    canSkip,
    confirm,
    skip,
    cancel,
    setOption,
    toggleColor,
    moodHighlighted,
    moodSelected,
    onMoodClick,
    playerHighlighted,
    playerSelected,
    onPlayerClick,
    handCardHighlighted,
    handCardSelected,
    onHandCardClick,
    dragCard,
    beginDrag,
    endDrag,
    legalDiscardCards,
    beginDiscardPlay,
    playToField,
    playToMood,
    playToPlayer,
    dragLegalMood,
    dragLegalPlayer,
    canDropMood,
    canDropPlayer,
  };
}

// Shared drag-legality helpers (used both for highlight and drop validation).
function dragLegalMoodImpl(card: number, uid: string, state: GameState, me: string): boolean {
  const spec = specFor(card);
  if (!spec || !firstBoardSlot(spec) || firstBoardSlot(spec)!.kind !== 'mood') return false;
  return isLegalDrop(card, uid, 'mood', state, me, cardLookup);
}
function dragLegalPlayerImpl(card: number, pid: string, state: GameState, me: string): boolean {
  const spec = specFor(card);
  if (!spec || !firstBoardSlot(spec) || firstBoardSlot(spec)!.kind !== 'player') return false;
  return isLegalDrop(card, pid, 'player', state, me, cardLookup);
}
