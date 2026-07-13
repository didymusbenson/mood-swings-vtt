// Red cards (#80–#106). Encoded from data/cards.json rules text + docs/card-notes.md.
// Mirrors the style of cards/white.ts: player decisions come from ctx.choices
// (moods = uids, players = ids, cards = card numbers in hand, colors/option = misc);
// "may" effects are opt-in — if the required choice is absent, nothing happens.
//
// Convention for blanket "may destroy/return everything" effects that have no
// individual target to name (Rage, Wrath): the acting player opts in by passing
// choices.option === 'all'.
//
// NOTE ON THRESHOLDS: a few red cards' rules text in data/cards.json uses a lower
// value threshold than docs/card-notes.md's transcription (Anger [3] vs note [5];
// Hostility/Rage/Shock [2] vs note [3]). We encode the values shipped in
// data/cards.json (the data the engine actually loads); see the flag in the report.
import type { Mood } from '../types.js';
import type { ReadContext } from '../effects.js';
import { registerEffects } from './registry.js';

const byUid = (ctx: ReadContext, uid: string | undefined): Mood | undefined =>
  uid == null ? undefined : ctx.allMoods().find((m) => m.uid === uid);

// #80 Anger — [0]. You may put any number of moods with total value [3] or less
// into the discard pile. All chosen at once; the total of their current values
// must not exceed the threshold (a suppressed mood counts as [0]).
registerEffects(80, {
  afterPlaying: (ctx) => {
    const chosen = (ctx.choices.moods ?? [])
      .map((u) => byUid(ctx, u))
      .filter((m): m is Mood => m != null);
    if (chosen.length === 0) return;
    const total = chosen.reduce((s, m) => s + ctx.valueOf(m), 0);
    if (total > 5) return; // invalid selection — do nothing
    for (const m of chosen) ctx.discardMoodToPile(m);
  },
});

// #81 Animosity — [3]/[5]. [5] if any opponent has three or more cards in hand.
registerEffects(81, {
  intrinsicValue: (ctx) =>
    ctx.opponentsOf(ctx.self.owner).some((p) => (ctx.state.hands[p]?.length ?? 0) >= 3) ? 5 : 3,
});

// #82 Arrogance — [2]. You may choose an opponent; they choose one of their white
// or blue moods and it becomes yours. (Give-back "after this mood is no longer in
// play" has no engine hook — see flag in report; only the take is modelled.)
registerEffects(82, {
  afterPlaying: (ctx) => {
    const m = byUid(ctx, ctx.choices.moods?.[0]);
    if (!m || m.owner === ctx.me) return; // must be an opponent's mood
    const col = ctx.card(m).color;
    if (col !== 'white' && col !== 'blue') return;
    ctx.steal(m, ctx.me);
    ctx.self.data.tookUid = m.uid;
  },
});

// #83 Boredom — vanilla [4] (no rules text). No entry needed.

// #84 Bravado — [3]. You may put one of your other moods into the discard pile;
// if you do, play an additional mood this turn.
registerEffects(84, {
  afterPlaying: (ctx) => {
    const m = byUid(ctx, ctx.choices.moods?.[0]);
    if (!m || m.owner !== ctx.me || m.uid === ctx.self.uid) return;
    ctx.discardMoodToPile(m);
    ctx.grantAdditionalMood(1);
  },
});

// #85 Chaos — [6]. Shuffle all moods together, then deal them out one at a time
// starting with you in turn order. (No dedicated primitive — done via direct
// ctx.state mutation; see flag in report. Card identity/value/suppression persist.)
registerEffects(85, {
  afterPlaying: (ctx) => {
    const st = ctx.state;
    const pool = ctx.allMoods().slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = ctx.random(i + 1);
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    for (const p of st.players) st.moods[p.id] = [];
    const order = st.turnOrder;
    const start = Math.max(0, order.indexOf(ctx.me));
    const seq = [...order.slice(start), ...order.slice(0, start)];
    pool.forEach((m, i) => {
      const pid = seq[i % seq.length]!;
      m.owner = pid;
      st.moods[pid]!.push(m);
    });
  },
});

// #86 Compulsion — [3]. Choose another player; they give you a card from their
// hand (mandatory, if able). No hand-to-hand primitive — direct ctx.state move.
registerEffects(86, {
  afterPlaying: (ctx) => {
    const target = ctx.choices.players?.[0];
    if (target == null || target === ctx.me) return;
    const th = ctx.state.hands[target];
    if (!th || th.length === 0) return;
    const card = (ctx.choices.cards ?? []).find((c) => th.includes(c)) ?? th[0]!;
    th.splice(th.indexOf(card), 1);
    (ctx.state.hands[ctx.me] ??= []).push(card);
  },
});

// #87 Embarrassment — [3]/[5]. You may discard a hand card with [4], [5], or [6]
// in its top-right corner; if you do, this mood's value becomes [5].
registerEffects(87, {
  intrinsicValue: (ctx) => (ctx.self.data.boost ? 5 : 3),
  afterPlaying: (ctx) => {
    const c = ctx.choices.cards?.[0];
    if (c == null || ![4, 5, 6].includes(ctx.cardData(c).value)) return;
    ctx.discardFromHand(ctx.me, c);
    ctx.self.data.boost = true;
  },
});

// #88 Excitement — [3]/[6]. [6] if there are two or more black and/or green moods.
registerEffects(88, {
  intrinsicValue: (ctx) => (ctx.countColor('black') + ctx.countColor('green') >= 2 ? 6 : 3),
});

// #89 Exhilaration — [0]. To play: put one of your moods into the discard pile.
// While in play: score your moods an extra time. (No extra-scoring primitive —
// best-effort via adding the owner's mood total to roundScores after scoring.)
registerEffects(89, {
  canPlay: (ctx) => ctx.moodsOf(ctx.me).length >= 1,
  payCost: (ctx) => {
    const pick =
      ctx.moodsOf(ctx.me).find((m) => (ctx.choices.moods ?? []).includes(m.uid)) ??
      ctx.moodsOf(ctx.me)[0];
    if (pick) ctx.discardMoodToPile(pick);
  },
  afterScoring: (ctx) => {
    const extra = ctx.moodsOf(ctx.me).reduce((s, m) => s + m.currentValue, 0);
    ctx.state.roundScores[ctx.me] = (ctx.state.roundScores[ctx.me] ?? 0) + extra;
  },
});

// #90 Frustration — [6]/[3]. [3] if there are two or more white and/or blue moods.
registerEffects(90, {
  intrinsicValue: (ctx) => (ctx.countColor('white') + ctx.countColor('blue') >= 2 ? 3 : 6),
});

// #91 Fury — [4]. Each player chooses one of their highest-value moods and puts it
// into the discard pile. All chosen simultaneously (Fury can hit itself).
registerEffects(91, {
  afterPlaying: (ctx) => {
    const targets: Mood[] = [];
    for (const p of ctx.state.players) {
      const ms = ctx.moodsOf(p.id);
      if (ms.length === 0) continue;
      const max = Math.max(...ms.map((m) => ctx.valueOf(m)));
      const top = ms.filter((m) => ctx.valueOf(m) === max);
      const pick = top.find((m) => (ctx.choices.moods ?? []).includes(m.uid)) ?? top[0];
      if (pick) targets.push(pick);
    }
    for (const m of targets) ctx.discardMoodToPile(m);
  },
});

// #92 Glee — [0]/[6]. This mood's value is [6] if you played it this round.
// (Re-encoded here from cards/known/glee.ts.)
registerEffects(92, {
  intrinsicValue: (ctx) =>
    (ctx.self.data.playedRound as number | undefined) === ctx.state.round ? 6 : 0,
});

// #93 Gluttony — [2]. You may play an additional mood; if you do, after scoring
// put that (first) extra mood into the discard pile if it's still in play.
registerEffects(93, {
  afterPlaying: (ctx) => ctx.grantAdditionalMood(1),
  onOtherMoodPlayed: (ctx, played) => {
    if (ctx.self.data.extraUid == null) ctx.self.data.extraUid = played.uid;
  },
  afterScoring: (ctx) => {
    const uid = ctx.self.data.extraUid as string | undefined;
    const m = byUid(ctx, uid);
    if (m) ctx.discardMoodToPile(m);
  },
});

// #94 Hostility — [3]. You may put one of your black or green moods into the
// discard pile; if you do, put up to two moods each with value [2] or less into
// the discard pile. choices.moods[0] = sacrifice, moods[1..2] = targets.
registerEffects(94, {
  afterPlaying: (ctx) => {
    const uids = ctx.choices.moods ?? [];
    const sac = byUid(ctx, uids[0]);
    if (!sac || sac.owner !== ctx.me) return;
    const col = ctx.card(sac).color;
    if (col !== 'black' && col !== 'green') return;
    ctx.discardMoodToPile(sac);
    for (const uid of uids.slice(1, 3)) {
      const t = byUid(ctx, uid);
      if (t && ctx.valueOf(t) <= 3) ctx.discardMoodToPile(t);
    }
  },
});

// #95 Infatuation — [3]/[6][3]=9. You may put two of your other moods into the
// discard pile; if you do, this mood's value becomes [6][3].
registerEffects(95, {
  intrinsicValue: (ctx) => (ctx.self.data.boost ? 9 : 3),
  afterPlaying: (ctx) => {
    const mine = (ctx.choices.moods ?? [])
      .map((u) => byUid(ctx, u))
      .filter((m): m is Mood => m != null && m.owner === ctx.me && m.uid !== ctx.self.uid);
    if (mine.length < 2) return;
    ctx.discardMoodToPile(mine[0]!);
    ctx.discardMoodToPile(mine[1]!);
    ctx.self.data.boost = true;
  },
});

// #96 Instability — [2]. You may choose two moods from the same opponent; they
// give you one, then you give them one of yours. (The opponent's sub-choice is
// auto-resolved: they hand over the lower-value of the two — see flag.)
registerEffects(96, {
  afterPlaying: (ctx) => {
    const uids = ctx.choices.moods ?? [];
    const a = byUid(ctx, uids[0]);
    const b = byUid(ctx, uids[1]);
    if (!a || !b) return;
    const opp = a.owner;
    if (opp === ctx.me || b.owner !== opp) return; // two moods of one opponent
    const give = ctx.valueOf(a) <= ctx.valueOf(b) ? a : b;
    ctx.steal(give, ctx.me);
    const mine = ctx.moodsOf(ctx.me).filter((m) => m.uid !== ctx.self.uid && m.uid !== give.uid);
    const back =
      mine.find((m) => uids.includes(m.uid)) ??
      mine.slice().sort((x, y) => ctx.valueOf(x) - ctx.valueOf(y))[0];
    if (back) ctx.giveMood(back, opp);
  },
});

// #97 Passion — [0]. While scoring, you may score one of your opponents' moods as
// though it were yours (they still score it too). (No extra-scoring primitive and
// no choices in afterScoring — best-effort: auto-adds the opponents' highest mood.)
registerEffects(97, {
  afterScoring: (ctx) => {
    const opp = ctx.opponentsOf(ctx.me).flatMap((p) => ctx.moodsOf(p));
    if (opp.length === 0) return;
    const best = opp.reduce((a, b) => (b.currentValue > a.currentValue ? b : a));
    ctx.state.roundScores[ctx.me] = (ctx.state.roundScores[ctx.me] ?? 0) + best.currentValue;
  },
});

// #98 Rage — [2]. You may put all other moods with a value of [2] or less into the
// discard pile. Opt-in via choices.option === 'all'.
registerEffects(98, {
  afterPlaying: (ctx) => {
    if (ctx.choices.option !== 'all') return;
    for (const m of [...ctx.allMoods()]) {
      if (m.uid !== ctx.self.uid && ctx.valueOf(m) <= 3) ctx.discardMoodToPile(m);
    }
  },
});

// #99 Rebellion — [2]. Choose [0], [1], [2], or [3]; put all other moods with the
// chosen value into the discard pile (never itself).
registerEffects(99, {
  afterPlaying: (ctx) => {
    const n = ctx.choices.option;
    if (typeof n !== 'number' || ![0, 1, 2, 3].includes(n)) return;
    for (const m of [...ctx.allMoods()]) {
      if (m.uid !== ctx.self.uid && ctx.valueOf(m) === n) ctx.discardMoodToPile(m);
    }
  },
});

// #100 Recklessness — [0]. You may take an opponent's mood; after scoring give it
// back (if you still have it). While in play: after scoring put this on the bottom
// of the deck and draw a card.
registerEffects(100, {
  afterPlaying: (ctx) => {
    const m = byUid(ctx, ctx.choices.moods?.[0]);
    if (m && m.owner !== ctx.me) {
      ctx.steal(m, ctx.me);
      ctx.self.data.tookUid = m.uid;
    }
  },
  afterScoring: (ctx) => {
    const took = ctx.self.data.tookUid as string | undefined;
    if (took) {
      const m = byUid(ctx, took);
      if (m && m.owner === ctx.me && m.stolenFrom) ctx.giveMood(m, m.stolenFrom);
    }
    ctx.putOnBottomOfDeck(ctx.self);
    ctx.draw(ctx.me, 1);
  },
});

// #101 Shock — [2]. Choose up to two players; for each, put one of their moods with
// a value of [2] or less into the discard pile.
registerEffects(101, {
  afterPlaying: (ctx) => {
    for (const pid of (ctx.choices.players ?? []).slice(0, 2)) {
      const targets = ctx.moodsOf(pid).filter((m) => ctx.valueOf(m) <= 3);
      const chosen = targets.find((m) => (ctx.choices.moods ?? []).includes(m.uid)) ?? targets[0];
      if (chosen) ctx.discardMoodToPile(chosen);
    }
  },
});

// #102 Stubbornness — [3]. At the start of each of your turns, if another player
// has more moods than you, you may play an additional mood. There is no
// start-of-turn hook in the engine — this trigger is NOT modelled (see flag).
// Registered as a no-op so its printed [3] value is used.
registerEffects(102, {});

// #103 Thrill — [1]. You may put any number of your other moods into your hand; if
// you do, play that many additional moods this turn.
registerEffects(103, {
  afterPlaying: (ctx) => {
    let n = 0;
    for (const uid of ctx.choices.moods ?? []) {
      const m = byUid(ctx, uid);
      if (m && m.owner === ctx.me && m.uid !== ctx.self.uid) {
        ctx.returnMoodToHand(m, ctx.me);
        n++;
      }
    }
    if (n > 0) ctx.grantAdditionalMood(n);
  },
});

// #104 Triumph — [3]/[5]. [5] if you went first this round.
registerEffects(104, {
  intrinsicValue: (ctx) => (ctx.self.owner === ctx.state.firstPlayer ? 5 : 3),
});

// #105 Wrath — [0]. You may put all other moods into the discard pile.
// Opt-in via choices.option === 'all'.
registerEffects(105, {
  afterPlaying: (ctx) => {
    if (ctx.choices.option !== 'all') return;
    for (const m of [...ctx.allMoods()]) {
      if (m.uid !== ctx.self.uid) ctx.discardMoodToPile(m);
    }
  },
});

// #106 Zeal — [3]. You may put a card from your hand on the bottom of the deck; if
// you do, draw a card. (No hand-card-to-bottom primitive — direct ctx.state move.)
registerEffects(106, {
  afterPlaying: (ctx) => {
    const c = ctx.choices.cards?.[0];
    if (c == null) return;
    const hand = ctx.state.hands[ctx.me];
    if (!hand) return;
    const i = hand.indexOf(c);
    if (i < 0) return;
    hand.splice(i, 1);
    ctx.state.deck.push(c);
    ctx.draw(ctx.me, 1);
  },
});
