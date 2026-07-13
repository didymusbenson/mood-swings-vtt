// Black cards (#53–#79). Encoded from data/cards.json rules text + docs/card-notes.md.
// Effects that need player decisions read them from ctx.choices (moods = uids,
// players = ids, cards = card numbers in hand/discard, option/colors = misc).
// "May" effects are opt-in: if the required choice is absent, nothing happens.
//
// NOTE on printed value vs. Card Notes: data/cards.json (the engine's source of
// truth) prints Envy "+[1] per moodiest opponent mood", Sadness "+[1] per discard
// card" and Vanity "+[1] / +[2] per your mood". The MaRo Card Notes page quotes
// [2]/[2]/[3] respectively. We encode the printed cards.json numbers. See report.
import type { Color, Mood, PlayerId } from '../types.js';
import type { ReadContext } from '../effects.js';
import { registerEffects } from './registry.js';

const byUid = (ctx: ReadContext, uid: string | undefined): Mood | undefined =>
  uid == null ? undefined : ctx.allMoods().find((m) => m.uid === uid);

// #53 Ambition — [2]; may discard a hand card to play an additional mood.
registerEffects(53, {
  afterPlaying: (ctx) => {
    const c = ctx.choices.cards?.[0];
    if (c == null) return;
    ctx.discardFromHand(ctx.me, c);
    ctx.grantAdditionalMood(1);
  },
});

// #54 Angst — [3]; may discard one of your blue/red moods to play an additional
// mood this turn FROM THE DISCARD PILE. Colour uses in-play colour (colorOf), so
// Imagination can enable/disable this (Card Notes: "If Imagination changes your
// moods to a colour other than blue or red, you may not use them for this card").
registerEffects(54, {
  afterPlaying: (ctx) => {
    const m = byUid(ctx, ctx.choices.moods?.[0]);
    if (!m || m.owner !== ctx.me) return;
    const col = ctx.colorOf(m);
    if (col !== 'blue' && col !== 'red') return;
    ctx.discardMoodToPile(m);
    ctx.grantDiscardMood(1);
  },
});

// #55 Apathy — [4] vanilla (no effect).

// #56 Betrayal — [6]; give one of your moods to another player, then reclaim it
// after scoring (if it is still in play).
registerEffects(56, {
  afterPlaying: (ctx) => {
    const m = byUid(ctx, ctx.choices.moods?.[0]);
    const to = ctx.choices.players?.[0];
    if (!m || !to || to === ctx.me || m.owner !== ctx.me) return;
    ctx.giveMood(m, to);
    ctx.self.data.given = m.uid;
  },
  afterScoring: (ctx) => {
    const m = byUid(ctx, ctx.self.data.given as string | undefined);
    if (m) ctx.giveMood(m, ctx.self.owner);
  },
});

// #57 Bitterness — [0]; discard every other mood sharing the most common colour(s).
registerEffects(57, {
  afterPlaying: (ctx) => {
    const colors = ctx.mostCommonColors();
    for (const m of [...ctx.allMoods()]) {
      if (m.uid !== ctx.self.uid && colors.includes(ctx.colorOf(m))) ctx.discardMoodToPile(m);
    }
  },
});

// #58 Condescension — [3]/[6]; may give a hand card to another player to become [6].
registerEffects(58, {
  intrinsicValue: (ctx) => (ctx.self.data.boost ? 6 : 3),
  afterPlaying: (ctx) => {
    const c = ctx.choices.cards?.[0];
    const to = ctx.choices.players?.[0];
    if (c == null || !to || to === ctx.me) return;
    const hand = ctx.state.hands[ctx.me]!;
    const i = hand.indexOf(c);
    if (i < 0) return;
    hand.splice(i, 1);
    (ctx.state.hands[to] ??= []).push(c);
    ctx.self.data.boost = true;
  },
});

// #59 Contempt — [1]; may discard one green/white mood, or all green/white moods.
registerEffects(59, {
  afterPlaying: (ctx) => {
    const isGW = (m: Mood) => ['green', 'white'].includes(ctx.colorOf(m));
    if (ctx.choices.option === 'all') {
      for (const m of [...ctx.allMoods()]) if (m.uid !== ctx.self.uid && isGW(m)) ctx.discardMoodToPile(m);
    } else {
      const m = byUid(ctx, ctx.choices.moods?.[0]);
      if (m && isGW(m)) ctx.discardMoodToPile(m);
    }
  },
});

// #60 Corruption — [2]; choose one: bottom-deck up to two discard cards and draw
// that many, OR the round's winner wins two rounds. (Double-win approximated in
// afterScoring by pre-incrementing the projected winner — see report.)
registerEffects(60, {
  afterPlaying: (ctx) => {
    if (ctx.choices.option === 'wins') {
      ctx.self.data.doubleWin = true;
      return;
    }
    const cards = (ctx.choices.cards ?? []).slice(0, 2);
    let moved = 0;
    for (const c of cards) {
      const i = ctx.state.discard.indexOf(c);
      if (i >= 0) {
        ctx.state.discard.splice(i, 1);
        ctx.state.deck.push(c);
        moved++;
      }
    }
    if (moved > 0) ctx.draw(ctx.me, moved);
  },
  afterScoring: (ctx) => {
    if (!ctx.self.data.doubleWin) return;
    const scores = ctx.state.roundScores;
    let best: PlayerId | null = null;
    let bestScore = -Infinity;
    for (const pid of ctx.state.actedThisRound) {
      const s = scores[pid] ?? 0;
      if (s > bestScore) {
        bestScore = s;
        best = pid;
      }
    }
    const p = best ? ctx.state.players.find((pp) => pp.id === best) : undefined;
    if (p) p.roundsWon += 1;
  },
});

// #61 Cruelty — [3]; chosen opponents with 2+ moods each discard a random mood.
registerEffects(61, {
  afterPlaying: (ctx) => {
    for (const pid of ctx.choices.players ?? []) {
      if (pid === ctx.me) continue;
      const ms = ctx.moodsOf(pid);
      if (ms.length < 2) continue;
      const victim = ms[ctx.random(ms.length)];
      if (victim) ctx.discardMoodToPile(victim);
    }
  },
});

// #62 Cynicism — [3]/[6]; may move a discard card into an opponent's hand to become [6].
registerEffects(62, {
  intrinsicValue: (ctx) => (ctx.self.data.boost ? 6 : 3),
  afterPlaying: (ctx) => {
    const c = ctx.choices.cards?.[0];
    const to = ctx.choices.players?.[0];
    if (c == null || !to || to === ctx.me) return;
    const i = ctx.state.discard.indexOf(c);
    if (i < 0) return;
    ctx.state.discard.splice(i, 1);
    (ctx.state.hands[to] ??= []).push(c);
    ctx.self.data.boost = true;
  },
});

// #63 Disgust — [6]/[3]; [3] if two or more green and/or white moods.
registerEffects(63, {
  intrinsicValue: (ctx) => (ctx.countColor('green') + ctx.countColor('white') >= 2 ? 3 : 6),
});

// #64 Envy — [0]; cost: discard one of your moods. Value +[1] per moodiest opponent's mood.
registerEffects(64, {
  canPlay: (ctx) => ctx.moodsOf(ctx.me).length >= 1,
  payCost: (ctx) => {
    const m = byUid(ctx, ctx.choices.moods?.[0]) ?? ctx.moodsOf(ctx.me)[0];
    if (m && m.owner === ctx.me) ctx.discardMoodToPile(m);
  },
  intrinsicValue: (ctx) => {
    let max = 0;
    for (const p of ctx.opponentsOf(ctx.self.owner)) max = Math.max(max, ctx.moodsOf(p).length);
    return max * 2; // [0] base + [2] per moodiest opponent mood
  },
});

// #65 Grief — [0]; "You may play up to two additional moods this turn from the
// discard pile." Grants two discard-plays (the player may use 0, 1, or 2, each
// resolved via a { from: 'discard' } action).
registerEffects(65, {
  afterPlaying: (ctx) => ctx.grantDiscardMood(2),
});

// #66 Hate — [0]; may bottom-deck any mood and draw a card.
registerEffects(66, {
  afterPlaying: (ctx) => {
    const m = byUid(ctx, ctx.choices.moods?.[0]);
    if (!m) return;
    ctx.putOnBottomOfDeck(m);
    ctx.draw(ctx.me, 1);
  },
});

// #67 Intimidation — [1]; may take a revealed card from another player's hand and
// play it as an additional mood.
registerEffects(67, {
  afterPlaying: (ctx) => {
    const to = ctx.choices.players?.[0];
    if (!to || to === ctx.me) return;
    const oppHand = ctx.state.hands[to];
    if (!oppHand || oppHand.length === 0) return;
    const c = ctx.choices.cards?.[0];
    const idx = c != null && oppHand.includes(c) ? oppHand.indexOf(c) : 0;
    const card = oppHand.splice(idx, 1)[0]!;
    ctx.state.hands[ctx.me]!.push(card);
    ctx.grantAdditionalMood(1);
  },
});

// #68 Malice — [0]; a chosen 2+-mood player picks two of their moods; discard those
// plus every other mood sharing a colour with either. Malice never hits itself.
registerEffects(68, {
  afterPlaying: (ctx) => {
    const pid = ctx.choices.players?.[0];
    if (!pid) return;
    const ms = ctx.moodsOf(pid);
    if (ms.length < 2) return;
    const chosen = (ctx.choices.moods ?? [])
      .map((u) => byUid(ctx, u))
      .filter((m): m is Mood => !!m && m.owner === pid)
      .slice(0, 2);
    const picks = chosen.length === 2 ? chosen : ms.slice(0, 2);
    const colors = new Set(picks.map((m) => ctx.colorOf(m)));
    for (const m of [...ctx.allMoods()]) {
      if (m.uid === ctx.self.uid) continue;
      if (picks.some((p) => p.uid === m.uid) || colors.has(ctx.colorOf(m))) ctx.discardMoodToPile(m);
    }
  },
});

// #69 Melancholy — [3]; "While in play — You may play moods from the discard pile as
// though they were in your hand." Continuous permission (no extra play): while a
// Melancholy is in play for you, a { from: 'discard' } action may consume a normal
// play to play a mood from the discard pile.
registerEffects(69, {
  permitsPlayFromDiscard: () => true,
});

// #70 Misery — [2]/[6][2]=8; [8] if two or more discard-pile cards share a colour.
registerEffects(70, {
  intrinsicValue: (ctx) => {
    const counts = new Map<Color, number>();
    for (const n of ctx.state.discard) {
      const col = ctx.cardData(n).color;
      counts.set(col, (counts.get(col) ?? 0) + 1);
    }
    return [...counts.values()].some((v) => v >= 2) ? 8 : 2;
  },
});

// #71 Paranoia — [2]; may make a player reveal a random hand card, bottom-deck it, then you draw.
registerEffects(71, {
  afterPlaying: (ctx) => {
    const to = ctx.choices.players?.[0];
    if (!to) return;
    const hand = ctx.state.hands[to];
    if (!hand || hand.length === 0) return;
    const card = hand.splice(ctx.random(hand.length), 1)[0]!;
    ctx.state.deck.push(card);
    ctx.draw(ctx.me, 1);
  },
});

// #72 Pity — [3]/[6]; [6] if two or more blue and/or red moods.
registerEffects(72, {
  intrinsicValue: (ctx) => (ctx.countColor('blue') + ctx.countColor('red') >= 2 ? 6 : 3),
});

// #73 Rejection — [0]; may pick two other moods; if they share a colour or value, discard both.
registerEffects(73, {
  afterPlaying: (ctx) => {
    const ms = (ctx.choices.moods ?? [])
      .map((u) => byUid(ctx, u))
      .filter((m): m is Mood => !!m && m.uid !== ctx.self.uid)
      .slice(0, 2);
    if (ms.length < 2) return;
    const [a, b] = ms as [Mood, Mood];
    if (ctx.colorOf(a) === ctx.colorOf(b) || ctx.valueOf(a) === ctx.valueOf(b)) {
      ctx.discardMoodToPile(a);
      ctx.discardMoodToPile(b);
    }
  },
});

// #74 Sadness — [0]; value +[1] per card in the discard pile.
registerEffects(74, {
  intrinsicValue: (ctx) => ctx.state.discard.length * 2,
});

// #75 Self-Loathing — [6]; cost: discard one or more of your moods.
registerEffects(75, {
  canPlay: (ctx) => ctx.moodsOf(ctx.me).length >= 1,
  payCost: (ctx) => {
    const chosen = (ctx.choices.moods ?? [])
      .map((u) => byUid(ctx, u))
      .filter((m): m is Mood => !!m && m.owner === ctx.me);
    const targets = chosen.length > 0 ? chosen : [ctx.moodsOf(ctx.me)[0]!];
    for (const m of targets) ctx.discardMoodToPile(m);
  },
});

// #76 Spite — [1]; up to two chosen players each discard a mood with an even value.
registerEffects(76, {
  afterPlaying: (ctx) => {
    for (const pid of (ctx.choices.players ?? []).slice(0, 2)) {
      const evens = ctx.moodsOf(pid).filter((m) => ctx.valueOf(m) % 2 === 0);
      const chosen = evens.find((m) => (ctx.choices.moods ?? []).includes(m.uid)) ?? evens[0];
      if (chosen) ctx.discardMoodToPile(chosen);
    }
  },
});

// #77 Superiority — [3]/[6][1]=7; [7] if you have more moods than each other player.
registerEffects(77, {
  intrinsicValue: (ctx) => {
    const mine = ctx.moodsOf(ctx.self.owner).length;
    const more = ctx.opponentsOf(ctx.self.owner).every((p) => mine > ctx.moodsOf(p).length);
    return more ? 7 : 3;
  },
});

// #78 Suspicion — [3]; each chosen player discards a card from their hand.
registerEffects(78, {
  afterPlaying: (ctx) => {
    for (const pid of ctx.choices.players ?? []) {
      const hand = ctx.state.hands[pid];
      if (!hand || hand.length === 0) continue;
      const c = (ctx.choices.cards ?? []).find((x) => hand.includes(x));
      ctx.discardFromHand(pid, c ?? hand[0]!);
    }
  },
});

// #79 Vanity — [0]; value +[1] per your mood (incl. itself), or +[2] each if your hand is empty.
registerEffects(79, {
  intrinsicValue: (ctx) => {
    const mine = ctx.moodsOf(ctx.self.owner).length;
    const per = (ctx.state.hands[ctx.self.owner]?.length ?? 0) === 0 ? 3 : 1;
    return mine * per;
  },
});
