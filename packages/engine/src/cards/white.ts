// White cards (#1–#26). Encoded from data/cards.json rules text + docs/card-notes.md.
// Effects that need player decisions read them from ctx.choices (moods = uids,
// players = ids, cards = card numbers in hand, option/number/colors = misc).
// "May" effects are opt-in: if the required choice is absent, nothing happens.
import type { Color, PlayerId } from '../types.js';
import type { Mood } from '../types.js';
import type { ReadContext } from '../effects.js';
import { registerEffects } from './registry.js';

const byUid = (ctx: ReadContext, uid: string | undefined): Mood | undefined =>
  uid == null ? undefined : ctx.allMoods().find((m) => m.uid === uid);

// #1 Altruism — [3], becomes [6][1]=7 if the discard had cards; then deal one
// random discard card to each player (from next in turn order) and bottom-deck the rest.
registerEffects(1, {
  intrinsicValue: (ctx) => (ctx.self.data.boost ? 7 : 3),
  afterPlaying: (ctx) => {
    const st = ctx.state;
    ctx.self.data.boost = st.discard.length > 0;
    if (st.discard.length === 0) return;
    const order = st.turnOrder;
    const start = (order.indexOf(ctx.me) + 1) % order.length;
    for (let i = 0; i < order.length && st.discard.length > 0; i++) {
      const pid = order[(start + i) % order.length]!;
      const idx = ctx.random(st.discard.length);
      st.hands[pid]!.push(st.discard.splice(idx, 1)[0]!);
    }
    while (st.discard.length > 0) st.deck.push(st.discard.splice(ctx.random(st.discard.length), 1)[0]!);
  },
});

// #2 Benevolence — additional mood if it shares no colour with your moods.
registerEffects(2, {
  afterPlaying: (ctx) => ctx.grantConditionalMood({ kind: 'colorNotSharedWithControllerMoods' }),
});

// #3 Charity — play an additional mood.
registerEffects(3, { afterPlaying: (ctx) => ctx.grantAdditionalMood(1) });

// #4 Chivalry — [3], but [5] if you didn't go first this round.
registerEffects(4, {
  intrinsicValue: (ctx) => (ctx.self.owner !== ctx.state.firstPlayer ? 5 : 3),
});

// #5 Complacency — vanilla (no effect).

// #6 Conviction — chosen mood's player bottom-decks it and draws.
registerEffects(6, {
  afterPlaying: (ctx) => {
    const m = byUid(ctx, ctx.choices.moods?.[0]);
    if (!m) return;
    const owner = m.owner;
    ctx.putOnBottomOfDeck(m);
    ctx.draw(owner, 1);
  },
});

// #7 Courage — up to two chosen players each lose a mood worth [1]+.
registerEffects(7, {
  afterPlaying: (ctx) => {
    for (const pid of (ctx.choices.players ?? []).slice(0, 2)) {
      const targets = ctx.moodsOf(pid).filter((m) => ctx.valueOf(m) >= 5);
      const chosen = targets.find((m) => (ctx.choices.moods ?? []).includes(m.uid)) ?? targets[0];
      if (chosen) ctx.discardMoodToPile(chosen);
    }
  },
});

// #8 Dignity — [3]; discard a hand card printed [0]–[3] to make this [5].
registerEffects(8, {
  intrinsicValue: (ctx) => (ctx.self.data.boost ? 5 : 3),
  afterPlaying: (ctx) => {
    const c = ctx.choices.cards?.[0];
    if (c == null || ![0, 1, 2, 3].includes(ctx.cardData(c).value)) return;
    ctx.discardFromHand(ctx.me, c);
    ctx.self.data.boost = true;
  },
});

// #9 Discipline — [6], but [3] if two or more black and/or red moods are in play.
registerEffects(9, {
  intrinsicValue: (ctx) => (ctx.countColor('black') + ctx.countColor('red') >= 2 ? 3 : 6),
});

// #10 Disillusionment — discard each other mood sharing a chosen colour.
registerEffects(10, {
  afterPlaying: (ctx) => {
    const colors = (ctx.choices.colors as Color[] | undefined) ?? [];
    if (!colors.length) return;
    for (const m of [...ctx.allMoods()]) {
      if (m.uid !== ctx.self.uid && colors.includes(ctx.card(m).color)) ctx.discardMoodToPile(m);
    }
  },
});

// #11 Encouragement — a chosen mood with a secondary value uses the higher of its two values.
registerEffects(11, {
  afterPlaying: (ctx) => {
    const m = byUid(ctx, ctx.choices.moods?.[0]);
    if (m && ctx.card(m).secondaryValue) ctx.self.data.target = m.uid;
  },
  whileInPlay: (ctx) => {
    const uid = ctx.self.data.target as string | undefined;
    const t = byUid(ctx, uid);
    if (!t) return [];
    const sec = ctx.card(t).secondaryValue?.value ?? 0;
    return [{ appliesTo: (m) => m.uid === uid, op: { kind: 'max', n: sec } }];
  },
});

// #12 Faith — discard a green/blue card to suppress any mood (sustained).
registerEffects(12, {
  afterPlaying: (ctx) => {
    const c = ctx.choices.cards?.[0];
    const m = byUid(ctx, ctx.choices.moods?.[0]);
    if (c == null || !m) return;
    const col = ctx.cardData(c).color;
    if (col !== 'green' && col !== 'blue') return;
    ctx.discardFromHand(ctx.me, c);
    ctx.suppress(m, 'sustained', true);
  },
});

// #13 Friendliness — additional mood if it's printed [0]–[3].
registerEffects(13, {
  afterPlaying: (ctx) => ctx.grantConditionalMood({ kind: 'primaryValueIn', values: [0, 2, 4, 6] }),
});

// #14 Guilt — suppress one black/red mood, or all of them (sustained).
registerEffects(14, {
  afterPlaying: (ctx) => {
    const isBR = (m: Mood) => ['black', 'red'].includes(ctx.card(m).color);
    if (ctx.choices.option === 'all') {
      for (const m of ctx.allMoods()) if (isBR(m)) ctx.suppress(m, 'sustained', true);
    } else {
      const m = byUid(ctx, ctx.choices.moods?.[0]);
      if (m && isBR(m)) ctx.suppress(m, 'sustained', true);
    }
  },
});

// #15 Honor — a chosen player leads every round while this is in play.
registerEffects(15, {
  afterPlaying: (ctx) => {
    const p = ctx.choices.players?.[0];
    if (p) ctx.self.data.forcedFirst = p;
  },
  forcesFirstPlayer: (ctx) => (ctx.self.data.forcedFirst as PlayerId | undefined) ?? null,
});

// #16 Idealism — additional mood; your moods with a secondary use the higher value.
registerEffects(16, {
  afterPlaying: (ctx) => ctx.grantAdditionalMood(1),
  whileInPlay: (ctx) => {
    const mods = [];
    for (const m of ctx.moodsOf(ctx.self.owner)) {
      const sec = ctx.card(m).secondaryValue?.value;
      if (sec != null) mods.push({ appliesTo: (x: Mood) => x.uid === m.uid, op: { kind: 'max' as const, n: sec } });
    }
    return mods;
  },
});

// #17 Kindness — additional mood if it's printed [1]–[3].
registerEffects(17, {
  afterPlaying: (ctx) => ctx.grantConditionalMood({ kind: 'primaryValueIn', values: [1, 3, 5] }),
});

// #18 Loyalty — [3], but [6] if two or more green and/or blue moods are in play.
registerEffects(18, {
  intrinsicValue: (ctx) => (ctx.countColor('green') + ctx.countColor('blue') >= 2 ? 6 : 3),
});

// #19 Meekness — suppress all moods worth [2]+ (sustained).
registerEffects(19, {
  afterPlaying: (ctx) => {
    for (const m of ctx.allMoods()) if (m.uid !== ctx.self.uid && ctx.valueOf(m) >= 5) ctx.suppress(m, 'sustained', true);
  },
});

// #20 Pacifism — up to two chosen players each have a mood suppressed (sustained).
registerEffects(20, {
  afterPlaying: (ctx) => {
    for (const uid of (ctx.choices.moods ?? []).slice(0, 2)) {
      const m = byUid(ctx, uid);
      if (m) ctx.suppress(m, 'sustained', true);
    }
  },
});

// #21 Patience — [5], but [1] the round you played it.
registerEffects(21, {
  intrinsicValue: (ctx) => (ctx.self.data.playedRound === ctx.state.round ? 1 : 5),
});

// #22 Pride — keep playing additional moods until you match a chosen larger player.
registerEffects(22, {
  afterPlaying: (ctx) => {
    const p = ctx.choices.players?.[0];
    if (!p) return;
    const target = ctx.moodsOf(p).length;
    if (target > ctx.moodsOf(ctx.me).length) ctx.grantConditionalMood({ kind: 'whileMoodCountBelow', target });
  },
});

// #23 Repentance — suppress all other moods with a chosen value (until end of round).
registerEffects(23, {
  afterPlaying: (ctx) => {
    const n = ctx.choices.option as number | undefined;
    if (n == null) return;
    for (const m of ctx.allMoods()) if (m.uid !== ctx.self.uid && ctx.valueOf(m) === n) ctx.suppress(m, 'round', true);
  },
});

// #24 Scorn — suppress any mood (until end of round); each later mood you play may
// suppress a mood sharing that colour (auto-targets an eligible mood).
registerEffects(24, {
  afterPlaying: (ctx) => {
    const m = byUid(ctx, ctx.choices.moods?.[0]);
    if (m) ctx.suppress(m, 'round', true);
  },
  onOtherMoodPlayed: (ctx, played) => {
    const col = ctx.card(played).color;
    const t = ctx
      .allMoods()
      .find((m) => m.uid !== played.uid && m.uid !== ctx.self.uid && ctx.card(m).color === col && m.suppressed === 'none');
    if (t) ctx.suppress(t, 'round', true);
  },
});

// #25 Shame — discard a card to suppress all other moods sharing its colour (sustained).
registerEffects(25, {
  afterPlaying: (ctx) => {
    const c = ctx.choices.cards?.[0];
    if (c == null) return;
    const col = ctx.cardData(c).color;
    ctx.discardFromHand(ctx.me, c);
    for (const m of ctx.allMoods()) if (m.uid !== ctx.self.uid && ctx.card(m).color === col) ctx.suppress(m, 'sustained', true);
  },
});

// #26 Validation — additional mood; each later mood you play printed [0]/[1] grants another.
registerEffects(26, {
  afterPlaying: (ctx) => ctx.grantAdditionalMood(1),
  onOtherMoodPlayed: (ctx, played) => {
    if ([0, 1].includes(ctx.card(played).value)) ctx.grantAdditionalMood(1);
  },
});
