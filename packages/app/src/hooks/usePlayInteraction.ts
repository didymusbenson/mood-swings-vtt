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

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Action, Choices, GameState } from '@mood-swings/engine';
import {
  specFor,
  legalTargets,
  isLegalDrop,
  playsImmediately,
  isSingleTarget,
  firstBoardSlot,
  playedMoodQualifies,
  queries,
  SELF_TARGET,
  type ChoiceSlot,
  type ChoiceSpec,
} from '@mood-swings/engine';
import { db } from '../game/db.js';
import { handWouldBe } from '../game/value.js';

export type PlayMode = 'manual' | 'drag';

const cardLookup = (n: number) => db.get(n);

/** Mutable selections gathered while walking a card's spec. */
interface Selections {
  moods: string[];
  players: string[];
  cards: number[];
  colors: string[];
  option: string | number | null;
  /** Creativity #32: the card number being copied (from the chosen mood). */
  copy: number | null;
  /** The uid of the copied mood, kept only to highlight it in the picker. */
  copyUid: string | null;
}

const emptySelections = (): Selections => ({
  moods: [], players: [], cards: [], colors: [], option: null, copy: null, copyUid: null,
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
  handCardHighlighted: (card: number) => boolean;
  handCardSelected: (card: number) => boolean;
  onHandCardClick: (card: number) => void;

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
function toggleBounded<T>(list: T[], value: T, max: number): T[] {
  if (list.includes(value)) return list.filter((v) => v !== value);
  if (list.length < max) return [...list, value];
  if (max === 1) return [value];
  return list; // at capacity for a multi-select — ignore extra clicks
}

export function usePlayInteraction(state: GameState, onAction: (a: Action) => void): PlayController {
  const [mode, setMode] = useState<PlayMode>('manual');
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [dragCard, setDragCard] = useState<number | null>(null);

  const me = state.activePlayer;
  const canAct = state.phase === 'awaitingPlay';

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
      const isLast = f.slotIndex >= spec.slots.length - 1;
      if (isLast) {
        onAction({
          type: 'play',
          player: me,
          card: f.card,
          choices: assembleChoices(f.sel),
          ...(f.from === 'discard' ? { from: f.from } : {}),
        });
        setFlow(null);
      } else {
        setFlow({ ...f, spec, slotIndex: f.slotIndex + 1 });
      }
    },
    [me, onAction],
  );

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
    else if (currentSlot.key === 'cards') sel.cards = [];
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
      if (!canAct || flow) return;
      setSelectedCard((cur) => (cur === card ? null : card));
    },
    [canAct, flow],
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
      setFlow((f) => (f ? { ...f, sel: { ...f.sel, moods: toggleBounded(f.sel.moods, uid, currentSlot.max) } } : f));
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
    (card: number) => {
      if (flow && currentSlot && currentSlot.kind === 'handCard') {
        if (!legalNow?.cards?.includes(card)) return;
        setFlow((f) => (f ? { ...f, sel: { ...f.sel, cards: toggleBounded(f.sel.cards, card, currentSlot.max) } } : f));
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

  const handCardHighlighted = useCallback(
    (card: number) => !!(flow && currentSlot?.kind === 'handCard' && legalNow?.cards?.includes(card)),
    [flow, currentSlot, legalNow],
  );
  const handCardSelected = useCallback((card: number) => !!flow?.sel.cards.includes(card), [flow]);

  // --- Drag & drop ---
  const beginDrag = useCallback(
    (card: number) => {
      if (!canAct || flow) return;
      setSelectedCard(null);
      setDragCard(card);
    },
    [canAct, flow],
  );
  const endDrag = useCallback(() => setDragCard(null), []);

  // Drop resolvers take the card explicitly (not the async `dragCard` state) so
  // the pointer hook's captured closure resolves the drop even mid-render.
  const playToField = useCallback(
    (card: number) => {
      setDragCard(null);
      beginPlay(card); // no specific target → immediate or open flow at slot 0
    },
    [beginPlay],
  );

  const playToMood = useCallback(
    (card: number, uid: string) => {
      setDragCard(null);
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

  const slotProgress = flow && currentSlot ? { count: countForSlot(currentSlot, flow.sel), min: currentSlot.min, max: currentSlot.max } : null;
  const canConfirm = !!(flow && currentSlot && countForSlot(currentSlot, flow.sel) >= currentSlot.min);
  const canSkip = !!(flow && currentSlot && (currentSlot.optional || currentSlot.min === 0));

  return {
    mode,
    setMode,
    canAct,
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
