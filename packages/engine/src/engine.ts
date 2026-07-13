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
      phase: 'awaitingPlay',
      round: 1,
      activePlayer: firstPlayer,
      playsRemaining: 1,
      conditionalGrants: [],
      playedThisTurn: [],
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
        const m = removeMood(mood);
        if (m) {
          state.discard.push(m.card);
          push(`${pname(owner)}'s ${label} is discarded`, 'discard');
        }
      },
      returnMoodToHand: (mood, to) => {
        const label = nm(mood);
        const m = removeMood(mood);
        if (m) {
          (state.hands[to ?? m.owner] ??= []).push(m.card);
          push(`${label} returns to ${pname(to ?? m.owner)}'s hand`, 'return');
        }
      },
      discardFromHand: (player, card) => {
        const hand = state.hands[player]!;
        const i = hand.indexOf(card);
        if (i >= 0) {
          state.discard.push(hand.splice(i, 1)[0]!);
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
        const m = removeMood(mood);
        if (m) {
          state.deck.push(m.card);
          push(`${label} is put on the bottom of the deck`, 'bottomdeck');
        }
      },
      grantAdditionalMood: (n = 1) => {
        state.playsRemaining += n;
      },
      grantConditionalMood: (constraint) => {
        state.conditionalGrants.push({ constraint });
      },
      suppress: (mood, duration, bySelf = false) => {
        mood.suppressed = duration;
        mood.suppressedBy = bySelf ? me : null;
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
      log: (message) => state.log.push({ round: state.round, message, kind: 'info', actor: me }),
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
      // Passing always ends the current player's turn (declining any extra plays).
      this.logPush(state, `${this.pname(state, action.player)} passes`, 'pass', { actor: action.player });
      this.completeTurn(state, action.player);
    } else {
      this.playMood(state, action.player, action.card, action.choices ?? {});
      // Turn continues only while the player still has a play available.
      const canContinue = state.playsRemaining > 0 || state.conditionalGrants.length > 0;
      if (!canContinue) this.completeTurn(state, action.player);
    }
    return state;
  }

  private completeTurn(state: GameState, player: PlayerId): void {
    state.actedThisRound.push(player);
    this.endTurn(state);
    this.advance(state);
  }

  private playMood(state: GameState, me: PlayerId, card: CardNumber, choices: Choices): void {
    const hand = state.hands[me]!;
    if (!hand.includes(card)) throw new Error(`${me} does not hold #${card}`);
    const data = this.db.get(card);

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

    // Consume a play slot (base play or a matching conditional grant).
    this.consumePlay(state, me, data);

    // 1. pay cost (before the mood enters play)
    eff.payCost?.(costCtx);

    // 2. enter play
    hand.splice(hand.indexOf(card), 1);
    state.moods[me]!.push(mood);
    state.playedThisTurn.push(mood.uid);
    this.logPush(state, `${this.pname(state, me)} plays ${data.name}`, 'play', { actor: me });

    // 3. while-in-play stabilises
    this.stabilise(state);

    // 4. after-playing
    eff.afterPlaying?.(this.playContext(state, mood, me, choices));
    this.stabilise(state);

    // 5. "each time you play another mood" triggers on the player's other moods
    for (const other of [...state.moods[me]!]) {
      if (other.uid === mood.uid) continue;
      const oeff = effectsFor(resolveCardNumber(other));
      oeff.onOtherMoodPlayed?.(this.playContext(state, other, me, {}), mood);
    }
    this.stabilise(state);
  }

  /** Spend a play: the base play, else a matching conditional grant. */
  private consumePlay(state: GameState, me: PlayerId, data: CardData): void {
    if (state.playsRemaining > 0) {
      state.playsRemaining -= 1;
      return;
    }
    const idx = state.conditionalGrants.findIndex((g) => this.grantAllows(g, data, me, state));
    if (idx < 0) throw new Error(`${me} has no available play for #${data.number}`);
    // Repeatable grants (Pride) stay until their condition fails; others are single-use.
    if (state.conditionalGrants[idx]!.constraint.kind !== 'whileMoodCountBelow') {
      state.conditionalGrants.splice(idx, 1);
    }
  }

  private grantAllows(grant: ConditionalGrant, data: CardData, me: PlayerId, state: GameState): boolean {
    const c: PlayConstraint = grant.constraint;
    switch (c.kind) {
      case 'primaryValueIn':
        return c.values.includes(data.value);
      case 'colorNotSharedWithControllerMoods':
        return !(state.moods[me] ?? []).some((m) => this.db.get(resolveCardNumber(m)).color === data.color);
      case 'whileMoodCountBelow':
        return (state.moods[me] ?? []).length < c.target;
    }
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
      resetTurn(state);
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
    this.logPush(
      state,
      `Scoring — ${state.players.map((p) => `${this.pname(state, p.id)} ${state.roundScores[p.id]}`).join(', ')}`,
      'score'
    );
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
    this.logPush(
      state,
      `${this.pname(state, winner)} wins round ${state.round} (${winP.roundsWon}/${ROUNDS_TO_WIN})`,
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

    // 'round'-duration suppressions clear as the round ends.
    for (const m of allMoods(state)) {
      if (m.suppressed === 'round') {
        m.suppressed = 'none';
        m.suppressedBy = null;
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

    state.round += 1;
    state.firstPlayer = first;
    state.activePlayer = first;
    state.turnOrder = orderFrom(state.players.map((p) => p.id), first);
    state.actedThisRound = [];
    state.roundScores = {};
    state.phase = 'awaitingPlay';
    resetTurn(state);
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

/** Reset the per-turn play budget when a new player's turn begins. */
function resetTurn(state: GameState): void {
  state.playsRemaining = 1;
  state.conditionalGrants = [];
  state.playedThisTurn = [];
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
