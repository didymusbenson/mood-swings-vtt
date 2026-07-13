// Blue cards (#27–#52). Encoded from data/cards.json rules text + docs/card-notes.md.
// Mirrors cards/white.ts: player decisions come from ctx.choices (moods = uids,
// players = ids, cards = card numbers in hand, option/number/colors = misc).
// "May" effects are opt-in: if the required choice is absent, nothing happens.
// Mandatory effects (Avoidance, Confusion, Guile, Regret) auto-pick a sensible
// target when the acting player supplied no choice, so the game can still resolve.
import type { Color, Mood, PlayerId } from '../types.js';
import type { PlayContext, ReadContext } from '../effects.js';
import { registerEffects, effectsFor } from './registry.js';
import { resolveCardNumber } from '../queries.js';

const byUid = (ctx: ReadContext, uid: string | undefined): Mood | undefined =>
  uid == null ? undefined : ctx.allMoods().find((m) => m.uid === uid);

/** Who is currently winning the round (highest score; ties → earliest to act).
 *  Mirrors Engine.roundWinner so "after scoring" effects (Bashfulness) can read it. */
const roundLeader = (ctx: ReadContext): PlayerId => {
  const st = ctx.state;
  const order = (id: PlayerId) => {
    const i = st.actedThisRound.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...st.players]
    .map((p) => p.id)
    .sort((a, b) => {
      const d = (st.roundScores[b] ?? 0) - (st.roundScores[a] ?? 0);
      return d !== 0 ? d : order(a) - order(b);
    })[0]!;
};

// #27 Ambivalence — [6]/[3] While in play: [3] if two or more red and/or green moods.
registerEffects(27, {
  intrinsicValue: (ctx) => (ctx.countColor('red') + ctx.countColor('green') >= 2 ? 3 : 6),
});

// #28 Anxiety — [2]; up to two chosen players each return a mood with an odd value.
registerEffects(28, {
  afterPlaying: (ctx) => {
    for (const pid of (ctx.choices.players ?? []).slice(0, 2)) {
      const targets = ctx.moodsOf(pid).filter((m) => ctx.valueOf(m) % 2 === 1);
      const chosen = targets.find((m) => (ctx.choices.moods ?? []).includes(m.uid)) ?? targets[0];
      if (chosen) ctx.returnMoodToHand(chosen);
    }
  },
});

// #29 Avoidance — [3]; choose left/right, each player gives one mood to the next
// player in that direction. Mandatory & simultaneous: collect all picks, then move.
registerEffects(29, {
  afterPlaying: (ctx) => {
    const dir = ctx.choices.option;
    if (dir !== 'left' && dir !== 'right') return;
    const st = ctx.state;
    const ids = st.players.map((p) => p.id);
    const step = dir === 'right' ? 1 : -1;
    const chosen = ctx.choices.moods ?? [];
    const moves: Array<{ mood: Mood; to: PlayerId }> = [];
    st.players.forEach((p, i) => {
      const mine = ctx.moodsOf(p.id);
      if (mine.length === 0) return; // a player with no moods passes nothing
      const mood = mine.find((m) => chosen.includes(m.uid)) ?? mine[0]!;
      moves.push({ mood, to: ids[(i + step + ids.length) % ids.length]! });
    });
    for (const mv of moves) ctx.giveMood(mv.mood, mv.to);
  },
});

// #30 Bashfulness — [6]; after scoring, if you won the round, bottom-deck this and draw.
registerEffects(30, {
  afterScoring: (ctx) => {
    if (roundLeader(ctx) !== ctx.self.owner) return;
    const owner = ctx.self.owner;
    ctx.putOnBottomOfDeck(ctx.self);
    ctx.draw(owner, 1);
  },
});

// #31 Confusion — [4]; choose left/right, each player passes one hand card that way.
// Mandatory & simultaneous. NOTE: no hand-to-hand primitive exists — done via
// direct state.hands mutation (see report).
registerEffects(31, {
  afterPlaying: (ctx) => {
    const dir = ctx.choices.option;
    if (dir !== 'left' && dir !== 'right') return;
    const st = ctx.state;
    const ids = st.players.map((p) => p.id);
    const step = dir === 'right' ? 1 : -1;
    const picks: Array<{ card: number; from: PlayerId; to: PlayerId }> = [];
    st.players.forEach((p, i) => {
      const hand = st.hands[p.id] ?? [];
      if (hand.length === 0) return;
      let card = hand[0]!;
      if (p.id === ctx.me) {
        const want = ctx.choices.cards?.[0];
        if (want != null && hand.includes(want)) card = want;
      }
      picks.push({ card, from: p.id, to: ids[(i + step + ids.length) % ids.length]! });
    });
    for (const pk of picks) st.hands[pk.from]!.splice(st.hands[pk.from]!.indexOf(pk.card), 1);
    for (const pk of picks) (st.hands[pk.to] ??= []).push(pk.card);
  },
});

// #32 Creativity — [0]; may play as a copy of any mood (choices.option = card number).
// copyOf makes value/colour/identity resolve through the copied card, and we fire the
// copied card's "after playing" effect. LIMITATION: the copied card's "To play this card"
// cost (canPlay/payCost) is NOT paid, and the copy-before-cost ordering is unsupported
// (the engine resolves this play's hooks from card #32). See report.
registerEffects(32, {
  afterPlaying: (ctx) => {
    const n = ctx.choices.option;
    if (typeof n !== 'number') return; // "may": decline when no card is named
    try {
      ctx.cardData(n);
    } catch {
      return; // unknown card number
    }
    ctx.self.copyOf = n;
    effectsFor(n).afterPlaying?.({ ...ctx, self: ctx.self });
  },
});

// #33 Curiosity — [3]/[6]; may choose a player who reveals a random hand card; if it
// shares a colour with any mood, this becomes [6].
registerEffects(33, {
  intrinsicValue: (ctx) => (ctx.self.data.boost ? 6 : 3),
  afterPlaying: (ctx) => {
    const pid = ctx.choices.players?.[0];
    if (!pid) return;
    const hand = ctx.state.hands[pid] ?? [];
    if (hand.length === 0) return;
    const revealed = hand[ctx.random(hand.length)]!;
    const col = ctx.cardData(revealed).color;
    if (ctx.allMoods().some((m) => ctx.card(m).color === col)) ctx.self.data.boost = true;
  },
});

// #34 Denial — [1]; may choose two other moods; if they share a colour or value, both
// return to their players' hands.
registerEffects(34, {
  afterPlaying: (ctx) => {
    const uids = ctx.choices.moods ?? [];
    const a = byUid(ctx, uids[0]);
    const b = byUid(ctx, uids[1]);
    if (!a || !b || a.uid === b.uid || a.uid === ctx.self.uid || b.uid === ctx.self.uid) return;
    const sameColor = ctx.card(a).color === ctx.card(b).color;
    const sameValue = ctx.valueOf(a) === ctx.valueOf(b);
    if (sameColor || sameValue) {
      ctx.returnMoodToHand(a);
      ctx.returnMoodToHand(b);
    }
  },
});

// #35 Disorientation — [0]; may choose a number; return every other mood with that value.
registerEffects(35, {
  afterPlaying: (ctx) => {
    const n = ctx.choices.option;
    if (typeof n !== 'number') return;
    for (const m of [...ctx.allMoods()]) {
      if (m.uid !== ctx.self.uid && ctx.valueOf(m) === n) ctx.returnMoodToHand(m);
    }
  },
});

// #36 Doubt — [2]; may reveal any number of hand cards, bottom-deck them, draw that many.
// LIMITATION: the "next round can't play those colours" restriction is not enforceable
// (no play-gate primitive); we record the colours + log it. See report.
registerEffects(36, {
  afterPlaying: (ctx) => {
    const hand = ctx.state.hands[ctx.me]!;
    const revealed = (ctx.choices.cards ?? []).filter((c) => hand.includes(c));
    if (revealed.length === 0) return;
    for (const c of revealed) {
      hand.splice(hand.indexOf(c), 1);
      ctx.state.deck.push(c);
    }
    ctx.draw(ctx.me, revealed.length);
    const colors = [...new Set(revealed.map((c) => ctx.cardData(c).color))];
    ctx.self.data.restrictedColors = colors;
    ctx.log(`Doubt: next round should bar colours ${colors.join(',')} (not enforced by engine)`);
  },
});

// #37 Duplicity — [0]; may play an additional mood; each later mood you play may have its
// "after playing" effect happen an extra time.
registerEffects(37, {
  afterPlaying: (ctx) => ctx.grantAdditionalMood(1),
  onOtherMoodPlayed: (ctx, played) => {
    const eff = effectsFor(resolveCardNumber(played));
    // Re-run with the played mood as `self`. It receives no fresh choices, so any
    // choice-driven ("may") part simply declines — faithful to the effect being optional.
    eff.afterPlaying?.({ ...ctx, self: played } as PlayContext);
  },
});

// #38 Fear — [0]; may return one of your other moods to hand; may play an additional mood.
registerEffects(38, {
  afterPlaying: (ctx) => {
    const m = byUid(ctx, ctx.choices.moods?.[0]);
    if (m && m.uid !== ctx.self.uid && m.owner === ctx.me) ctx.returnMoodToHand(m);
    ctx.grantAdditionalMood(1);
  },
});

// #39 Fickleness — [0]; return every other mood sharing a most-common colour to hand.
registerEffects(39, {
  afterPlaying: (ctx) => {
    const colors = ctx.mostCommonColors();
    for (const m of [...ctx.allMoods()]) {
      if (m.uid !== ctx.self.uid && colors.includes(ctx.card(m).color)) ctx.returnMoodToHand(m);
    }
  },
});

// #40 Guile — [0]; To play: discard two cards. After: take one of your opponents' moods.
registerEffects(40, {
  canPlay: (ctx) => (ctx.state.hands[ctx.me]?.length ?? 0) >= 3, // this Guile + two to discard
  payCost: (ctx) => {
    const hand = ctx.state.hands[ctx.me]!;
    const pool = [...hand];
    pool.splice(pool.indexOf(40), 1); // set aside the Guile being played
    const pick: number[] = [];
    for (const c of ctx.choices.cards ?? []) {
      const i = pool.indexOf(c);
      if (i >= 0 && pick.length < 2) {
        pool.splice(i, 1);
        pick.push(c);
      }
    }
    while (pick.length < 2 && pool.length) pick.push(pool.shift()!);
    for (const c of pick) ctx.discardFromHand(ctx.me, c);
  },
  afterPlaying: (ctx) => {
    const chosen = byUid(ctx, ctx.choices.moods?.[0]);
    const m = chosen && chosen.owner !== ctx.me ? chosen : ctx.allMoods().find((x) => x.owner !== ctx.me);
    if (m) ctx.giveMood(m, ctx.me); // "becomes yours" (permanent — no give-back)
  },
});

// #41 Hesitation — [2]; may choose one: return a red/green mood, or all red/green moods.
registerEffects(41, {
  afterPlaying: (ctx) => {
    const isRG = (m: Mood) => ['red', 'green'].includes(ctx.card(m).color);
    if (ctx.choices.option === 'all') {
      for (const m of [...ctx.allMoods()]) if (isRG(m)) ctx.returnMoodToHand(m);
    } else {
      const m = byUid(ctx, ctx.choices.moods?.[0]);
      if (m && isRG(m)) ctx.returnMoodToHand(m);
    }
  },
});

// #42 Imagination — [3]; choose a colour; while in play all moods are that colour.
// LIMITATION: no colour-override primitive — the engine derives colour from card data,
// so the global recolour cannot be applied (it would affect countColor / mostCommonColors
// / every colour check). We record the choice and log it. See report.
registerEffects(42, {
  afterPlaying: (ctx) => {
    const col = (ctx.choices.colors as Color[] | undefined)?.[0] ?? (ctx.choices.option as Color | undefined);
    if (col) {
      ctx.self.data.imaginedColor = col;
      ctx.log(`Imagination: all moods should become ${col} (recolour not enforced by engine)`);
    }
  },
});

// #43 Indecisiveness — [3]; any number of opponents with 2+ moods each return a random one.
registerEffects(43, {
  afterPlaying: (ctx) => {
    for (const pid of ctx.choices.players ?? []) {
      if (pid === ctx.me) continue; // opponents only
      const moods = ctx.moodsOf(pid);
      if (moods.length < 2) continue;
      ctx.returnMoodToHand(moods[ctx.random(moods.length)]!);
    }
  },
});

// #44 Indifference — vanilla (no rules text); the engine scores its printed [4] by default.

// #45 Insecurity — [2]; may play an additional mood; after scoring return that mood to hand.
registerEffects(45, {
  afterPlaying: (ctx) => {
    ctx.grantAdditionalMood(1);
    ctx.self.data.awaiting = true;
  },
  onOtherMoodPlayed: (ctx, played) => {
    // Tag the first mood played after Insecurity as the "additional" one.
    if (ctx.self.data.awaiting) {
      ctx.self.data.trackedUid = played.uid;
      ctx.self.data.awaiting = false;
    }
  },
  afterScoring: (ctx) => {
    const m = byUid(ctx, ctx.self.data.trackedUid as string | undefined);
    if (m) ctx.returnMoodToHand(m, ctx.self.owner);
  },
});

// #46 Neurosis — [5]; To play: return one or more of your moods to hand.
registerEffects(46, {
  canPlay: (ctx) => ctx.moodsOf(ctx.me).length >= 1,
  payCost: (ctx) => {
    const mine = ctx.moodsOf(ctx.me);
    const uids = ctx.choices.moods ?? [];
    const chosen = mine.filter((m) => uids.includes(m.uid));
    const targets = chosen.length > 0 ? chosen : [mine[0]!]; // must return at least one
    for (const m of targets) ctx.returnMoodToHand(m);
  },
});

// #47 Obsession — [3]/[6] While in play: [6] if two or more white and/or black moods.
registerEffects(47, {
  intrinsicValue: (ctx) => (ctx.countColor('white') + ctx.countColor('black') >= 2 ? 6 : 3),
});

// #48 Panic — [1]; up to two chosen players each return one mood to hand (not this one).
registerEffects(48, {
  afterPlaying: (ctx) => {
    for (const pid of (ctx.choices.players ?? []).slice(0, 2)) {
      const targets = ctx.moodsOf(pid).filter((m) => m.uid !== ctx.self.uid);
      const chosen = targets.find((m) => (ctx.choices.moods ?? []).includes(m.uid)) ?? targets[0];
      if (chosen) ctx.returnMoodToHand(chosen);
    }
  },
});

// #49 Rationalization — [3]; may choose one: recycle your whole hand (option 'deck'),
// or pass every player's whole hand left/right. LIMITATION: whole-hand moves have no
// primitive — done via direct state.hands / state.deck mutation. See report.
registerEffects(49, {
  afterPlaying: (ctx) => {
    const st = ctx.state;
    const opt = ctx.choices.option;
    if (opt === 'deck' || opt === 'recycle') {
      const hand = st.hands[ctx.me]!;
      const n = hand.length;
      st.deck.push(...hand.splice(0));
      ctx.draw(ctx.me, n);
    } else if (opt === 'left' || opt === 'right') {
      const ids = st.players.map((p) => p.id);
      const step = opt === 'right' ? 1 : -1;
      const snap = st.players.map((p) => [...(st.hands[p.id] ?? [])]);
      st.players.forEach((p, i) => {
        st.hands[ids[(i + step + ids.length) % ids.length]!] = snap[i]!;
      });
    }
  },
});

// #50 Regret — [4]; To play: return two of your moods to hand. After: take an opponent's
// mood into your hand.
registerEffects(50, {
  canPlay: (ctx) => ctx.moodsOf(ctx.me).length >= 2,
  payCost: (ctx) => {
    const mine = ctx.moodsOf(ctx.me);
    const uids = ctx.choices.moods ?? [];
    const chosen = mine.filter((m) => uids.includes(m.uid));
    const targets = (chosen.length >= 2 ? chosen : mine).slice(0, 2);
    for (const m of targets) ctx.returnMoodToHand(m);
  },
  afterPlaying: (ctx) => {
    const uids = ctx.choices.moods ?? [];
    const target =
      uids.map((u) => byUid(ctx, u)).find((m) => m && m.owner !== ctx.me) ??
      ctx.allMoods().find((m) => m.owner !== ctx.me);
    if (target) ctx.returnMoodToHand(target, ctx.me); // opponent's mood into YOUR hand
  },
});

// #51 Sneakiness — [5]; choose an opponent; after scoring, swap your score with theirs
// before the round winner is decided.
registerEffects(51, {
  afterPlaying: (ctx) => {
    const p = ctx.choices.players?.[0];
    if (p && p !== ctx.me) ctx.self.data.swapWith = p;
  },
  afterScoring: (ctx) => {
    const p = ctx.self.data.swapWith as PlayerId | undefined;
    if (!p) return;
    const st = ctx.state;
    const me = ctx.self.owner;
    const mine = st.roundScores[me] ?? 0;
    st.roundScores[me] = st.roundScores[p] ?? 0;
    st.roundScores[p] = mine;
  },
});

// #52 Worry — [3]; may return one of your white/black moods to hand; if you do, return up
// to two other moods each worth [3] or less.
registerEffects(52, {
  afterPlaying: (ctx) => {
    const uids = ctx.choices.moods ?? [];
    const cost = byUid(ctx, uids[0]);
    if (!cost || cost.owner !== ctx.me || !['white', 'black'].includes(ctx.card(cost).color)) return;
    ctx.returnMoodToHand(cost);
    let placed = 0;
    for (const uid of uids.slice(1)) {
      if (placed >= 2) break;
      const m = byUid(ctx, uid);
      if (m && m.uid !== ctx.self.uid && ctx.valueOf(m) <= 3) {
        ctx.returnMoodToHand(m);
        placed++;
      }
    }
  },
});
