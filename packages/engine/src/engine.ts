// The Mood Swings rules engine: value stabilisation + the round/game loop.
// See docs/RULES.md for the authoritative rules this implements.

import {
  ROUNDS_TO_WIN,
  STARTING_HAND,
  type CardData,
  type CardNumber,
  type Color,
  type GameState,
  type LogEntry,
  type LogKind,
  type Mood,
  type PlayerId,
} from './types.js';
import type {
  Choices,
  MutationApi,
  PlayContext,
  ReadContext,
  ValueModifier,
  ValueOp,
} from './effects.js';
import type { ConditionalGrant, PlayConstraint } from './types.js';
import { CardDB, effectsFor } from './cards/registry.js';
import { nextRandom, shuffle } from './rng.js';
import {
  allMoods,
  colorOf,
  countColor,
  moodiest,
  mostCommonColors,
  printedValue,
  resolveCardNumber,
} from './queries.js';
import { SELF_TARGET } from './cards/choice-spec.js';

const MAX_STABILISE_ITERATIONS = 64;

export type Action =
  | {
      type: 'play';
      player: PlayerId;
      card: CardNumber;
      choices?: Choices;
      /**
       * Where the played card comes from. 'hand' (default) plays a card from the
       * player's hand; 'discard' plays a mood from the shared discard pile and
       * requires a discard-play permission (a `grantDiscardMood` grant, or a
       * Melancholy #69 in play). See docs/RULES.md "Play a mood from the discard pile".
       */
      from?: 'hand' | 'discard';
    }
  | { type: 'pass'; player: PlayerId };

export interface SetupOptions {
  players: { id: PlayerId; name: string }[];
  /** Shared deck as a list of card numbers (already the full multiset). */
  deck: CardNumber[];
  seed?: number;
  /** First player of round 1. Defaults to players[0]. */
  firstPlayer?: PlayerId;
  /** Skip the initial shuffle (useful for deterministic tests). */
  preshuffled?: boolean;
}

export class Engine {
  constructor(private readonly db: CardDB) {}

  private pname(state: GameState, id: PlayerId): string {
    return state.players.find((p) => p.id === id)?.name ?? id;
  }

  private logPush(state: GameState, message: string, kind: LogKind, extra: Partial<LogEntry> = {}): void {
    state.log.push({ round: state.round, message, kind, ...extra });
  }

  // ---- setup ------------------------------------------------------------

  setup(opts: SetupOptions): GameState {
    if (opts.players.length < 2) throw new Error('Need at least 2 players');
    let seed = opts.seed ?? 1;
    let deck = opts.deck.slice();
    if (!opts.preshuffled) {
      const s = shuffle(deck, seed);
      deck = s.items;
      seed = s.seed;
    }
    const players = opts.players.map((p) => ({ id: p.id, name: p.name, roundsWon: 0 }));
    const hands: Record<PlayerId, CardNumber[]> = {};
    const moods: Record<PlayerId, Mood[]> = {};
    for (const p of players) {
      hands[p.id] = deck.splice(0, STARTING_HAND);
      moods[p.id] = [];
    }
    const firstPlayer = opts.firstPlayer ?? players[0]!.id;
    const turnOrder = orderFrom(players.map((p) => p.id), firstPlayer);

    const state: GameState = {
      players,
      deck,
      discard: [],
      hands,
      moods,
      revealed: {},
      phase: 'awaitingPlay',
      round: 1,
      activePlayer: firstPlayer,
      playsRemaining: 1,
      discardPlaysRemaining: 0,
      conditionalGrants: [],
      pendingExtraPlays: {},
      pendingDiscardPlays: {},
      playedThisTurn: [],
      firstPlayer,
      turnOrder,
      actedThisRound: [],
      roundScores: {},
      discardedThisRound: 0,
      bannedColors: [],
      pendingBannedColors: [],
      winner: null,
      seed,
      uidCounter: 0,
      log: [],
    };
    // Apply the first player's turn-start play budget (no moods/pending yet, so this
    // is just the base play — but keeps the turn-start path in one place).
    this.resetTurn(state);
    this.stabilise(state);
    return state;
  }

  // ---- value stabilisation (fixpoint) -----------------------------------

  /**
   * Recompute every mood's `currentValue` to a stable fixed point:
   * intrinsic values → while-in-play modifiers → suppression, repeated until
   * nothing changes (docs/RULES.md: "keep applying While in play effects until
   * you have stable values").
   */
  stabilise(state: GameState): void {
    // Colour overrides (Imagination) depend only on board membership, not on
    // values, so resolve them once up front — before any colour-caring value
    // computation reads countColor / mostCommonColors / ctx.colorOf.
    this.applyColorOverrides(state);

    const moods = allMoods(state);
    let prev = new Map<string, number>(moods.map((m) => [m.uid, m.currentValue]));

    for (let iter = 0; iter < MAX_STABILISE_ITERATIONS; iter++) {
      const values = new Map<string, number>();
      const read = (self: Mood): ReadContext => this.readContext(state, self, prev);

      // 1. intrinsic values
      for (const m of moods) {
        const eff = effectsFor(resolveCardNumber(m));
        values.set(m.uid, eff.intrinsicValue ? eff.intrinsicValue(read(m)) : printedValue(m, this.db));
      }

      // 2. while-in-play modifiers (adds first, then sets)
      const mods: Array<{ mod: ValueModifier; source: Mood }> = [];
      for (const m of moods) {
        const eff = effectsFor(resolveCardNumber(m));
        if (eff.whileInPlay) for (const mod of eff.whileInPlay(read(m))) mods.push({ mod, source: m });
      }
      const applyPass = (kind: ValueOp['kind']) => {
        for (const { mod, source } of mods) {
          if (mod.op.kind !== kind) continue;
          for (const target of moods) {
            if (!mod.appliesTo(target, this.readContext(state, source, prev))) continue;
            const cur = values.get(target.uid) ?? 0;
            const next =
              mod.op.kind === 'add' ? cur + mod.op.n
              : mod.op.kind === 'max' ? Math.max(cur, mod.op.n)
              : mod.op.n;
            values.set(target.uid, next);
          }
        }
      };
      applyPass('add');
      applyPass('set');
      applyPass('max');

      // 3. suppression forces 0; clamp negatives to 0
      for (const m of moods) {
        if (m.suppressed !== 'none') values.set(m.uid, 0);
        else values.set(m.uid, Math.max(0, values.get(m.uid) ?? 0));
      }

      if (mapsEqual(values, prev)) {
        for (const m of moods) m.currentValue = values.get(m.uid) ?? 0;
        return;
      }
      prev = values;
    }
    // Didn't converge (a pathological card loop) — take the last computed values.
    for (const m of moods) m.currentValue = prev.get(m.uid) ?? 0;
  }

  /**
   * Recompute every mood's `colorOverride` from the moods in play. If any mood
   * forces a global colour (Imagination #42's `colorOverride` hook), the most
   * recently played such mood wins and recolours EVERY mood (itself included);
   * otherwise all overrides clear. Purely membership-driven, so a mood entering
   * play is recoloured and everything reverts when the source leaves play.
   */
  private applyColorOverrides(state: GameState): void {
    const moods = allMoods(state);
    let chosen: Color | null = null;
    let winner = -1;
    for (const m of moods) {
      const hook = effectsFor(resolveCardNumber(m)).colorOverride;
      if (!hook) continue;
      const c = hook(this.readContext(state, m, snapshot(state)));
      if (c == null) continue;
      const order = uidOrder(m.uid);
      if (order >= winner) {
        winner = order;
        chosen = c;
      }
    }
    for (const m of moods) m.colorOverride = chosen;
  }

  // ---- contexts ---------------------------------------------------------

  private readContext(state: GameState, self: Mood, prev: Map<string, number>): ReadContext {
    const db = this.db;
    return {
      state,
      self,
      card: (mood) => db.get(resolveCardNumber(mood)),
      cardData: (cardNumber) => db.get(cardNumber),
      valueOf: (mood) => prev.get(mood.uid) ?? mood.currentValue,
      allMoods: () => allMoods(state),
      moodsOf: (player) => state.moods[player] ?? [],
      opponentsOf: (player) => state.players.map((p) => p.id).filter((id) => id !== player),
      colorOf: (mood) => colorOf(mood, db),
      countColor: (color: Color) => countColor(state, db, color),
      mostCommonColors: () => mostCommonColors(state, db),
      moodiest: () => moodiest(state),
    };
  }

  private mutationApi(state: GameState, self: Mood, me: PlayerId, choices: Choices): MutationApi {
    const db = this.db;
    const removeMood = (mood: Mood): Mood | undefined => {
      for (const p of state.players) {
        const arr = state.moods[p.id]!;
        const i = arr.findIndex((m) => m.uid === mood.uid);
        if (i >= 0) return arr.splice(i, 1)[0];
      }
      return undefined;
    };
    const pname = (id: PlayerId) => state.players.find((p) => p.id === id)?.name ?? id;
    const nm = (mood: Mood) => db.get(resolveCardNumber(mood)).name;
    const push = (message: string, kind: LogKind, extra: Partial<LogEntry> = {}) =>
      state.log.push({ round: state.round, message, kind, actor: me, ...extra });
    return {
      me,
      choices,
      discardMoodToPile: (mood) => {
        const label = nm(mood);
        const owner = mood.owner;
        this.fireLeavePlay(state, mood);
        const m = removeMood(mood);
        if (m) {
          state.discard.push(m.card);
          state.discardedThisRound += 1;
          clearSuppressionsBy(state, m.uid); // sustained suppressions end when the suppressor leaves play
          push(`${pname(owner)}'s ${label} is discarded`, 'discard');
        }
      },
      returnMoodToHand: (mood, to) => {
        const label = nm(mood);
        this.fireLeavePlay(state, mood);
        const m = removeMood(mood);
        if (m) {
          (state.hands[to ?? m.owner] ??= []).push(m.card);
          clearSuppressionsBy(state, m.uid);
          push(`${label} returns to ${pname(to ?? m.owner)}'s hand`, 'return');
        }
      },
      discardFromHand: (player, card) => {
        const hand = state.hands[player]!;
        const i = hand.indexOf(card);
        if (i >= 0) {
          state.discard.push(hand.splice(i, 1)[0]!);
          state.discardedThisRound += 1;
          push(`${pname(player)} discards ${db.get(card).name} from hand`, 'discard');
        }
      },
      draw: (player, n = 1) => {
        let drawn = 0;
        for (let k = 0; k < n && state.deck.length > 0; k++) {
          state.hands[player]!.push(state.deck.shift()!);
          drawn++;
        }
        // The card's identity is hidden (only the drawer knows) — omit it.
        if (drawn > 0) push(`${pname(player)} draws ${drawn === 1 ? 'a card' : `${drawn} cards`}`, 'draw', { private: player });
      },
      putOnBottomOfDeck: (mood) => {
        const label = nm(mood);
        this.fireLeavePlay(state, mood);
        const m = removeMood(mood);
        if (m) {
          state.deck.push(m.card);
          clearSuppressionsBy(state, m.uid);
          push(`${label} is put on the bottom of the deck`, 'bottomdeck');
        }
      },
      grantAdditionalMood: (n = 1) => {
        state.playsRemaining += n;
      },
      grantDiscardMood: (n = 1) => {
        state.discardPlaysRemaining += n;
      },
      grantConditionalMood: (constraint, from = 'hand') => {
        state.conditionalGrants.push({ constraint, from });
      },
      grantExtraPlayNextTurn: (player, n = 1) => {
        state.pendingExtraPlays[player] = (state.pendingExtraPlays[player] ?? 0) + n;
      },
      grantDiscardPlayNextTurn: (player, n = 1) => {
        state.pendingDiscardPlays[player] = (state.pendingDiscardPlays[player] ?? 0) + n;
      },
      suppress: (mood, duration, bySelf = false) => {
        mood.suppressed = duration;
        // For 'sustained', remember the SUPPRESSING mood (self) so the suppression can
        // be lifted when that mood leaves play / changes owner. (turn/round clear by timer.)
        mood.suppressedBy = bySelf ? self.uid : null;
        push(`${pname(me)} suppresses ${nm(mood)}`, 'suppress');
      },
      steal: (mood, to) => {
        const label = nm(mood);
        const from = mood.owner;
        mood.stolenFrom = mood.owner;
        const m = removeMood(mood);
        if (m) {
          m.owner = to;
          state.moods[to]!.push(m);
          clearSuppressionsBy(state, m.uid); // changing owner ends any sustained suppression it caused
          push(`${pname(to)} takes ${label} from ${pname(from)}`, 'steal');
        }
      },
      giveMood: (mood, to) => {
        const label = nm(mood);
        const from = mood.owner;
        const m = removeMood(mood);
        if (m) {
          m.owner = to;
          m.stolenFrom = null;
          state.moods[to]!.push(m);
          clearSuppressionsBy(state, m.uid);
          push(`${pname(from)} gives ${label} to ${pname(to)}`, 'give');
        }
      },
      rotateToSecondary: (mood, on = true) => {
        mood.usingSecondary = on;
      },
      random: (maxExclusive) => {
        const r = nextRandom(state.seed);
        state.seed = r.seed;
        return Math.floor(r.value * maxExclusive);
      },
      restabilize: () => this.stabilise(state),
      log: (message) => state.log.push({ round: state.round, message, kind: 'info', actor: me }),
      reveal: (holder, card) => {
        // A reveal is public: everyone sees which card it was. Log it, and record it so
        // redaction can keep it face-up in the holder's hand while it stays there.
        push(`${pname(holder)} reveals ${db.get(card).name}`, 'info');
        (state.revealed[holder] ??= []).push(card);
      },
    };
  }

  private playContext(state: GameState, self: Mood, me: PlayerId, choices: Choices): PlayContext {
    return { ...this.readContext(state, self, snapshot(state)), ...this.mutationApi(state, self, me, choices) };
  }

  /**
   * Fire a leaving mood's `onLeavePlay` hook (Arrogance #82 give-back). Called by the
   * true-leave mutations (discard / bottom-deck / return-to-hand) just before the mood
   * is removed — not by steal/give, which keep the mood in play under a new controller.
   */
  private fireLeavePlay(state: GameState, mood: Mood): void {
    const hook = effectsFor(resolveCardNumber(mood)).onLeavePlay;
    if (hook) hook(this.playContext(state, mood, mood.owner, {}));
  }

  // ---- actions ----------------------------------------------------------

  apply(prevState: GameState, action: Action): GameState {
    const state: GameState = structuredClone(prevState);
    if (state.phase !== 'awaitingPlay') throw new Error(`Cannot act in phase ${state.phase}`);
    if (action.player !== state.activePlayer) throw new Error(`Not ${action.player}'s turn`);

    if (action.type === 'pass') {
      // Passing always ends the current player's turn (declining any extra plays).
      this.logPush(state, `${this.pname(state, action.player)} passes`, 'pass', { actor: action.player });
      this.completeTurn(state, action.player);
    } else {
      this.playMood(state, action.player, action.card, action.choices ?? {}, action.from ?? 'hand');
      // Turn continues only while the player still has a play available.
      const canContinue =
        state.playsRemaining > 0 ||
        state.conditionalGrants.length > 0 ||
        state.discardPlaysRemaining > 0;
      if (!canContinue) this.completeTurn(state, action.player);
    }
    return state;
  }

  private completeTurn(state: GameState, player: PlayerId): void {
    state.actedThisRound.push(player);
    this.endTurn(state);
    this.advance(state);
  }

  private playMood(
    state: GameState,
    me: PlayerId,
    card: CardNumber,
    choices: Choices,
    from: 'hand' | 'discard' = 'hand',
  ): void {
    const source = from === 'discard' ? state.discard : state.hands[me]!;
    if (from === 'discard') {
      if (!state.discard.includes(card)) throw new Error(`#${card} is not in the discard pile`);
    } else if (!source.includes(card)) {
      throw new Error(`${me} does not hold #${card}`);
    }
    const data = this.db.get(card);
    // Doubt #36: no player may play a mood whose colour is banned this round.
    if (state.bannedColors.includes(data.color)) {
      throw new Error(`${data.color} moods can't be played this round (#${card})`);
    }

    // Build the mood up front so cost/effects can reference `self`.
    const mood: Mood = {
      uid: `m${state.uidCounter++}`,
      card,
      owner: me,
      stolenFrom: null,
      usingSecondary: false,
      suppressed: 'none',
      suppressedBy: null,
      copyOf: null,
      currentValue: 0,
      data: { playedRound: state.round },
    };
    const eff = effectsFor(card);
    const costCtx = this.costContext(state, mood, me, choices);
    if (eff.canPlay && !eff.canPlay(costCtx)) throw new Error(`Cannot pay cost for #${card}`);

    // Consume a play slot. A discard-sourced play spends a discard-play grant (or
    // a normal play via Melancholy #69); a hand play spends the base play or a
    // matching conditional grant.
    if (from === 'discard') this.consumeDiscardPlay(state, me, data);
    else this.consumePlay(state, me, data);

    // 1. pay cost (before the mood enters play)
    eff.payCost?.(costCtx);

    // 2. enter play (remove from its source zone: hand or the discard pile)
    source.splice(source.indexOf(card), 1);
    state.moods[me]!.push(mood);
    state.playedThisTurn.push(mood.uid);
    this.logPush(
      state,
      `${this.pname(state, me)} plays ${data.name}${from === 'discard' ? ' from the discard pile' : ''}`,
      'play',
      { actor: me },
    );

    // 3. while-in-play stabilises
    this.stabilise(state);

    // 4. after-playing. The mood is now in play, so a `selfTargetable` slot's
    // SELF_TARGET sentinel resolves to this mood's uid (Conviction #6 targeting itself).
    const afterChoices: Choices = choices.moods?.includes(SELF_TARGET)
      ? { ...choices, moods: choices.moods.map((u) => (u === SELF_TARGET ? mood.uid : u)) }
      : choices;
    eff.afterPlaying?.(this.playContext(state, mood, me, afterChoices));
    this.stabilise(state);

    // 5. "each time you play another mood" triggers on the player's other moods
    for (const other of [...state.moods[me]!]) {
      if (other.uid === mood.uid) continue;
      const oeff = effectsFor(resolveCardNumber(other));
      oeff.onOtherMoodPlayed?.(this.playContext(state, other, me, {}), mood);
    }
    this.stabilise(state);
  }

  /** Spend a play: the base play, else a matching hand-sourced conditional grant. */
  private consumePlay(state: GameState, me: PlayerId, data: CardData): void {
    if (state.playsRemaining > 0) {
      state.playsRemaining -= 1;
      return;
    }
    const idx = state.conditionalGrants.findIndex(
      (g) => (g.from ?? 'hand') === 'hand' && this.grantAllows(g, data, me, state),
    );
    if (idx < 0) throw new Error(`${me} has no available play for #${data.number}`);
    // Repeatable grants (Pride) stay until their condition fails; others are single-use.
    if (state.conditionalGrants[idx]!.constraint.kind !== 'whileMoodCountBelow') {
      state.conditionalGrants.splice(idx, 1);
    }
  }

  /**
   * Spend a discard-play: a dedicated discard-play grant (Angst/Grief/Harmony/
   * Grace), else — if the player has a Melancholy #69 in play permitting it — a
   * normal play (base or a matching conditional grant). Throws if neither exists,
   * so a hand card can never be played as a discard play and vice-versa.
   */
  private consumeDiscardPlay(state: GameState, me: PlayerId, data: CardData): void {
    if (state.discardPlaysRemaining > 0) {
      state.discardPlaysRemaining -= 1;
      return;
    }
    // A colour-matched discard grant (Grace #121) is a discard-sourced conditional grant.
    const idx = state.conditionalGrants.findIndex(
      (g) => g.from === 'discard' && this.grantAllows(g, data, me, state),
    );
    if (idx >= 0) {
      if (state.conditionalGrants[idx]!.constraint.kind !== 'whileMoodCountBelow') {
        state.conditionalGrants.splice(idx, 1);
      }
      return;
    }
    if (this.permitsPlayFromDiscard(state, me)) {
      this.consumePlay(state, me, data);
      return;
    }
    throw new Error(`${me} has no discard-play available for #${data.number}`);
  }

  /** Does the player control a mood that permits playing from the discard pile (Melancholy)? */
  private permitsPlayFromDiscard(state: GameState, me: PlayerId): boolean {
    return (state.moods[me] ?? []).some((m) => {
      const hook = effectsFor(resolveCardNumber(m)).permitsPlayFromDiscard;
      return !!hook && hook(this.readContext(state, m, snapshot(state)));
    });
  }

  private grantAllows(grant: ConditionalGrant, data: CardData, me: PlayerId, state: GameState): boolean {
    const c: PlayConstraint = grant.constraint;
    // The played card's colour is its printed colour (it is in hand or the discard
    // pile — neither zone is recoloured); the controller's moods use their in-play
    // colour (colorOf, honouring Imagination #42).
    const sharesColor = () => (state.moods[me] ?? []).some((m) => colorOf(m, this.db) === data.color);
    switch (c.kind) {
      case 'primaryValueIn':
        return c.values.includes(data.value);
      case 'colorNotSharedWithControllerMoods':
        return !sharesColor();
      case 'colorSharedWithControllerMoods':
        return sharesColor();
      case 'whileMoodCountBelow':
        // Live: your count vs the chosen player's CURRENT count (shrinking their board
        // mid-turn lowers your remaining allowance, per Pride's note).
        return (state.moods[me] ?? []).length < (state.moods[c.player] ?? []).length;
    }
  }

  /** Cost context: the mood is not yet in play, so effects act on existing board. */
  private costContext(state: GameState, self: Mood, me: PlayerId, choices: Choices): PlayContext {
    return { ...this.readContext(state, self, snapshot(state)), ...this.mutationApi(state, self, me, choices) };
  }

  // ---- turn / round progression ----------------------------------------

  private endTurn(state: GameState): void {
    // 'turn'-duration suppressions clear at end of the turn they were applied.
    for (const m of allMoods(state)) {
      if (m.suppressed === 'turn') {
        m.suppressed = 'none';
        m.suppressedBy = null;
      }
    }
    this.stabilise(state);
  }

  private advance(state: GameState): void {
    const remaining = state.turnOrder.filter((p) => !state.actedThisRound.includes(p));
    if (remaining.length > 0) {
      state.activePlayer = remaining[0]!;
      this.resetTurn(state);
      return;
    }
    this.score(state);
  }

  private score(state: GameState): void {
    state.phase = 'scoring';
    this.stabilise(state);

    // Awe #107: cancel this round's scoring entirely (no winner / draw / after-scoring).
    const canceller = allMoods(state).find((m) =>
      effectsFor(resolveCardNumber(m)).cancelsRoundScoring?.(this.readContext(state, m, snapshot(state))),
    );
    if (canceller) {
      this.skipRound(state, canceller);
      return;
    }

    for (const p of state.players) {
      state.roundScores[p.id] = (state.moods[p.id] ?? []).reduce((sum, m) => sum + m.currentValue, 0);
    }
    // "Score … an extra time" contributions (Bliss #108, Enthusiasm #116,
    // Exhilaration #89, Passion #97), applied before logging so the logged scores and
    // the round winner both reflect them.
    for (const m of allMoods(state)) {
      const hook = effectsFor(resolveCardNumber(m)).scoreExtras;
      if (!hook) continue;
      for (const { player, points } of hook(this.readContext(state, m, snapshot(state)))) {
        if (points) state.roundScores[player] = (state.roundScores[player] ?? 0) + points;
      }
    }
    // Snapshot the per-mood value breakdown NOW — moods leave play at round end,
    // so the log keeps its own copy for the expandable score explanation.
    const scores = state.players.map((p) => ({
      player: p.id,
      playerName: this.pname(state, p.id),
      total: state.roundScores[p.id] ?? 0,
      moods: (state.moods[p.id] ?? []).map((m) => ({
        name: this.db.get(resolveCardNumber(m)).name,
        value: m.currentValue,
      })),
    }));
    this.logPush(
      state,
      `Scoring — ${state.players.map((p) => `${this.pname(state, p.id)} ${state.roundScores[p.id]}`).join(', ')}`,
      'score',
      { scores }
    );
    this.afterScoring(state);
  }

  /**
   * Awe #107: end the round with no scoring — no winner, no losers drawing, no
   * after-scoring effects. The Awe player chooses who leads next round.
   */
  private skipRound(state: GameState, canceller: Mood): void {
    this.logPush(state, `No scoring this round — no one wins or loses`, 'round', { actor: canceller.owner });
    const chosen = effectsFor(resolveCardNumber(canceller)).chooseNextFirstPlayer?.(
      this.readContext(state, canceller, snapshot(state)),
    );
    this.startNextRound(state, chosen ?? state.firstPlayer);
  }

  private afterScoring(state: GameState): void {
    state.phase = 'afterScoring';
    // Resolve after-scoring effects in the order players took their turn.
    for (const pid of state.actedThisRound) {
      for (const mood of [...(state.moods[pid] ?? [])]) {
        const eff = effectsFor(resolveCardNumber(mood));
        eff.afterScoring?.(this.playContext(state, mood, pid, {}));
      }
    }
    this.endRound(state);
  }

  private endRound(state: GameState): void {
    const winner = this.roundWinner(state);
    const winP = state.players.find((p) => p.id === winner)!;
    // Base win + any extra round wins for the winner (Corruption #60's "wins two
    // rounds instead of one"), summed over every in-play mood granting it.
    let wins = 1;
    for (const m of allMoods(state)) {
      wins += effectsFor(resolveCardNumber(m)).extraRoundWinsForWinner?.(
        this.readContext(state, m, snapshot(state)),
      ) ?? 0;
    }
    winP.roundsWon += wins;
    this.logPush(
      state,
      `${this.pname(state, winner)} wins round ${state.round}${wins > 1 ? ` ×${wins}` : ''} (${winP.roundsWon}/${ROUNDS_TO_WIN})`,
      'round',
      { actor: winner }
    );

    if (winP.roundsWon >= ROUNDS_TO_WIN) {
      state.winner = winner;
      state.phase = 'gameOver';
      this.logPush(state, `${this.pname(state, winner)} wins the game!`, 'game', { actor: winner });
      return;
    }

    // Losers draw a card (2-player: the single loser). 3+ player Hurt Feelings
    // is intentionally deferred (MVP is 2-player).
    for (const p of state.players) {
      if (p.id !== winner) {
        const drawn = take(state, 1);
        state.hands[p.id]!.push(...drawn);
        if (drawn.length) this.logPush(state, `${this.pname(state, p.id)} draws a card`, 'draw', { actor: p.id, private: p.id });
      }
    }

    // Next round: winner leads, unless a mood forces a first player (Honor).
    let first: PlayerId = winner;
    for (const m of allMoods(state)) {
      const forced = effectsFor(resolveCardNumber(m)).forcesFirstPlayer?.(
        this.readContext(state, m, snapshot(state))
      );
      if (forced) first = forced;
    }
    this.startNextRound(state, first);
  }

  /**
   * Advance to the next round with the given first player: clear round-scoped
   * suppressions, reset per-round counters, rotate Doubt #36's staged colour ban into
   * effect, then begin the leader's turn. Shared by `endRound` (normal) and
   * `skipRound` (Awe #107, no scoring).
   */
  private startNextRound(state: GameState, first: PlayerId): void {
    // 'round'-duration suppressions clear as the round ends.
    for (const m of allMoods(state)) {
      if (m.suppressed === 'round') {
        m.suppressed = 'none';
        m.suppressedBy = null;
      }
    }
    state.round += 1;
    state.firstPlayer = first;
    state.activePlayer = first;
    state.turnOrder = orderFrom(state.players.map((p) => p.id), first);
    state.actedThisRound = [];
    state.roundScores = {};
    state.discardedThisRound = 0;
    state.revealed = {}; // revealed-hand knowledge is a per-round fog-of-war window
    // Doubt #36: the colours staged this round become unplayable for exactly this next round.
    state.bannedColors = state.pendingBannedColors;
    state.pendingBannedColors = [];
    state.phase = 'awaitingPlay';
    this.resetTurn(state);
    this.stabilise(state);
  }

  /**
   * Begin the active player's turn: reset the per-turn play budget to the base play,
   * then layer on (1) one-time pending grants (Joy #125 / Generosity #120), consumed
   * here, and (2) recurring while-in-play grants — for each of the active player's
   * moods, the `extraPlaysAtTurnStart` hook (Hope #124, Grace #121, Stubbornness #102),
   * re-evaluated every turn so they fire while the mood is in play and stop once it
   * leaves. This is the single turn-start path used by setup, advance, and endRound.
   */
  private resetTurn(state: GameState): void {
    const player = state.activePlayer;
    state.conditionalGrants = [];
    state.playedThisTurn = [];
    // Base play + one-time pending grants owed to this player (consumed now).
    state.playsRemaining = 1 + (state.pendingExtraPlays[player] ?? 0);
    state.discardPlaysRemaining = state.pendingDiscardPlays[player] ?? 0;
    state.pendingExtraPlays[player] = 0;
    state.pendingDiscardPlays[player] = 0;
    // Recurring while-in-play grants from this player's own moods.
    for (const m of state.moods[player] ?? []) {
      const hook = effectsFor(resolveCardNumber(m)).extraPlaysAtTurnStart;
      if (!hook) continue;
      const { normal = 0, fromDiscard = 0, grants = [] } = hook(this.readContext(state, m, snapshot(state)));
      state.playsRemaining += normal;
      state.discardPlaysRemaining += fromDiscard;
      for (const g of grants) state.conditionalGrants.push({ constraint: g.constraint, from: g.from ?? 'hand' });
    }
  }

  /** Highest score wins; tie → player who played earliest this round. */
  private roundWinner(state: GameState): PlayerId {
    const order = (id: PlayerId) => {
      const i = state.actedThisRound.indexOf(id);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...state.players]
      .map((p) => p.id)
      .sort((a, b) => {
        const d = (state.roundScores[b] ?? 0) - (state.roundScores[a] ?? 0);
        return d !== 0 ? d : order(a) - order(b);
      })[0]!;
  }
}

// ---- helpers ------------------------------------------------------------

function snapshot(state: GameState): Map<string, number> {
  return new Map(allMoods(state).map((m) => [m.uid, m.currentValue]));
}

/**
 * Lift every 'sustained' suppression that was imposed by the mood `uid` — used when
 * that suppressing mood leaves play or changes owner (RULES.md: sustained suppression
 * lasts "as long as the suppressing card stays in play on your side; stops if that
 * card changes owner"). 'turn'/'round' suppressions are timer-based and untouched.
 */
function clearSuppressionsBy(state: GameState, uid: string): void {
  for (const m of allMoods(state)) {
    if (m.suppressed === 'sustained' && m.suppressedBy === uid) {
      m.suppressed = 'none';
      m.suppressedBy = null;
    }
  }
}

/** Play-order key from a mood uid (`m<n>`): higher = played more recently. */
function uidOrder(uid: string): number {
  const n = Number.parseInt(uid.replace(/^m/, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

function orderFrom(ids: PlayerId[], first: PlayerId): PlayerId[] {
  const i = ids.indexOf(first);
  return i <= 0 ? ids.slice() : [...ids.slice(i), ...ids.slice(0, i)];
}

function take(state: GameState, n: number): CardNumber[] {
  const out: CardNumber[] = [];
  for (let k = 0; k < n && state.deck.length > 0; k++) out.push(state.deck.shift()!);
  return out;
}

function mapsEqual(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}
