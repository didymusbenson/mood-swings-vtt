// The Mood Swings rules engine: value stabilisation + the round/game loop.
// See docs/RULES.md for the authoritative rules this implements.

import {
  ROUNDS_TO_WIN,
  STARTING_HAND,
  type CardNumber,
  type Color,
  type GameState,
  type Mood,
  type PlayerId,
} from './types.js';
import type {
  Choices,
  MutationApi,
  PlayContext,
  ReadContext,
  ValueModifier,
} from './effects.js';
import { CardDB, effectsFor } from './cards/registry.js';
import { shuffle } from './rng.js';
import {
  allMoods,
  countColor,
  moodiest,
  mostCommonColors,
  printedValue,
  resolveCardNumber,
} from './queries.js';

const MAX_STABILISE_ITERATIONS = 64;

export type Action =
  | { type: 'play'; player: PlayerId; card: CardNumber; choices?: Choices }
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
      phase: 'awaitingPlay',
      round: 1,
      activePlayer: firstPlayer,
      firstPlayer,
      turnOrder,
      actedThisRound: [],
      roundScores: {},
      winner: null,
      seed,
      uidCounter: 0,
      log: [],
    };
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
      const applyPass = (kind: 'add' | 'set') => {
        for (const { mod, source } of mods) {
          if (mod.op.kind !== kind) continue;
          for (const target of moods) {
            if (!mod.appliesTo(target, this.readContext(state, source, prev))) continue;
            const cur = values.get(target.uid) ?? 0;
            values.set(target.uid, mod.op.kind === 'add' ? cur + mod.op.n : mod.op.n);
          }
        }
      };
      applyPass('add');
      applyPass('set');

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

  // ---- contexts ---------------------------------------------------------

  private readContext(state: GameState, self: Mood, prev: Map<string, number>): ReadContext {
    const db = this.db;
    return {
      state,
      self,
      card: (mood) => db.get(resolveCardNumber(mood)),
      valueOf: (mood) => prev.get(mood.uid) ?? mood.currentValue,
      allMoods: () => allMoods(state),
      moodsOf: (player) => state.moods[player] ?? [],
      opponentsOf: (player) => state.players.map((p) => p.id).filter((id) => id !== player),
      countColor: (color: Color) => countColor(state, db, color),
      mostCommonColors: () => mostCommonColors(state, db),
      moodiest: () => moodiest(state),
    };
  }

  private mutationApi(state: GameState, me: PlayerId, choices: Choices): MutationApi {
    const db = this.db;
    const removeMood = (mood: Mood): Mood | undefined => {
      for (const p of state.players) {
        const arr = state.moods[p.id]!;
        const i = arr.findIndex((m) => m.uid === mood.uid);
        if (i >= 0) return arr.splice(i, 1)[0];
      }
      return undefined;
    };
    return {
      me,
      choices,
      discardMoodToPile: (mood) => {
        const m = removeMood(mood);
        if (m) state.discard.push(m.card);
      },
      returnMoodToHand: (mood, to) => {
        const m = removeMood(mood);
        if (m) (state.hands[to ?? m.owner] ??= []).push(m.card);
      },
      discardFromHand: (player, card) => {
        const hand = state.hands[player]!;
        const i = hand.indexOf(card);
        if (i >= 0) state.discard.push(hand.splice(i, 1)[0]!);
      },
      draw: (player, n = 1) => {
        for (let k = 0; k < n && state.deck.length > 0; k++) {
          state.hands[player]!.push(state.deck.shift()!);
        }
      },
      suppress: (mood, duration, bySelf = false) => {
        mood.suppressed = duration;
        mood.suppressedBy = bySelf ? me : null;
      },
      steal: (mood, to) => {
        mood.stolenFrom = mood.owner;
        const m = removeMood(mood);
        if (m) {
          m.owner = to;
          state.moods[to]!.push(m);
        }
      },
      giveMood: (mood, to) => {
        const m = removeMood(mood);
        if (m) {
          m.owner = to;
          m.stolenFrom = null;
          state.moods[to]!.push(m);
        }
      },
      rotateToSecondary: (mood, on = true) => {
        mood.usingSecondary = on;
      },
      log: (message) => state.log.push({ round: state.round, message }),
    };
  }

  private playContext(state: GameState, self: Mood, me: PlayerId, choices: Choices): PlayContext {
    return { ...this.readContext(state, self, snapshot(state)), ...this.mutationApi(state, me, choices) };
  }

  // ---- actions ----------------------------------------------------------

  apply(prevState: GameState, action: Action): GameState {
    const state: GameState = structuredClone(prevState);
    if (state.phase !== 'awaitingPlay') throw new Error(`Cannot act in phase ${state.phase}`);
    if (action.player !== state.activePlayer) throw new Error(`Not ${action.player}'s turn`);

    if (action.type === 'pass') {
      state.log.push({ round: state.round, message: `${action.player} passes` });
    } else {
      this.playMood(state, action.player, action.card, action.choices ?? {});
    }

    state.actedThisRound.push(action.player);
    this.endTurn(state);
    this.advance(state);
    return state;
  }

  private playMood(state: GameState, me: PlayerId, card: CardNumber, choices: Choices): void {
    const hand = state.hands[me]!;
    if (!hand.includes(card)) throw new Error(`${me} does not hold #${card}`);

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

    // 1. pay cost (before the mood enters play)
    eff.payCost?.(costCtx);

    // 2. enter play
    hand.splice(hand.indexOf(card), 1);
    state.moods[me]!.push(mood);
    state.log.push({ round: state.round, message: `${me} plays ${this.db.get(card).name}` });

    // 3. while-in-play stabilises
    this.stabilise(state);

    // 4. after-playing
    eff.afterPlaying?.(this.playContext(state, mood, me, choices));

    // 5. re-stabilise
    this.stabilise(state);
  }

  /** Cost context: the mood is not yet in play, so effects act on existing board. */
  private costContext(state: GameState, self: Mood, me: PlayerId, choices: Choices): PlayContext {
    return { ...this.readContext(state, self, snapshot(state)), ...this.mutationApi(state, me, choices) };
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
      return;
    }
    this.score(state);
  }

  private score(state: GameState): void {
    state.phase = 'scoring';
    this.stabilise(state);
    for (const p of state.players) {
      state.roundScores[p.id] = (state.moods[p.id] ?? []).reduce((sum, m) => sum + m.currentValue, 0);
    }
    state.log.push({
      round: state.round,
      message: `Scores — ${state.players.map((p) => `${p.id}:${state.roundScores[p.id]}`).join(', ')}`,
    });
    this.afterScoring(state);
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
    winP.roundsWon += 1;
    state.log.push({ round: state.round, message: `${winner} wins round ${state.round}` });

    if (winP.roundsWon >= ROUNDS_TO_WIN) {
      state.winner = winner;
      state.phase = 'gameOver';
      return;
    }

    // Losers draw a card (2-player: the single loser). 3+ player Hurt Feelings
    // is intentionally deferred (MVP is 2-player).
    for (const p of state.players) {
      if (p.id !== winner) state.hands[p.id]!.push(...take(state, 1));
    }

    // Next round: winner leads.
    state.round += 1;
    state.firstPlayer = winner;
    state.activePlayer = winner;
    state.turnOrder = orderFrom(state.players.map((p) => p.id), winner);
    state.actedThisRound = [];
    state.roundScores = {};
    state.phase = 'awaitingPlay';
    this.stabilise(state);
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
