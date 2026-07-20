// Green cards (#107–#134). Encoded from data/cards.json rules text + docs/card-notes.md.
// Mirrors cards/white.ts: player decisions arrive on ctx.choices (moods = uids,
// players = ids, cards = card numbers in hand, option/number/colors = misc).
// "May" effects are opt-in: if the required choice is absent, nothing happens.
//
// NOW SUPPORTED (previously flagged gaps, all closed — see docs/effect-gaps.md):
// skipping a round's scoring (Awe #107 via `cancelsRoundScoring`); the "additional
// mood must share a colour with your moods" constraint (Eagerness #114, Grace #121's
// discard grant via `colorSharedWithControllerMoods`); round-scoped discard tracking
// (Vulnerability #132 via `state.discardedThisRound`); the extra-scoring hook (Bliss
// #108, Enthusiasm #116 via `scoreExtras`); recurring per-turn extra plays (Grace,
// Hope via `extraPlaysAtTurnStart`); and cross-turn / other-player extra plays
// (Generosity, Joy via `grantExtraPlayNextTurn`).
import type { Color, PlayerId } from '../types.js';
import type { ReadContext } from '../effects.js';
import { registerEffects } from './registry.js';

const FIVE: Color[] = ['white', 'blue', 'black', 'red', 'green'];
const ALL_COLORS: Color[] = ['white', 'blue', 'black', 'red', 'green', 'colorless'];

/** Distinct in-play colours among a player's moods (honours Imagination via colorOf). */
const distinctColors = (ctx: ReadContext, pid: PlayerId): number =>
  new Set(ctx.moodsOf(pid).map((m) => ctx.colorOf(m))).size;

// #107 Awe — "After playing this mood — There is no scoring this round. No one wins
// or loses this round. You choose which player goes first next round." Modelled with
// `cancelsRoundScoring` (gated to the round Awe was played, since the mood persists)
// which the engine consults at scoring time to skip scoring/winner/draw/after-scoring;
// `chooseNextFirstPlayer` supplies the chosen next leader.
registerEffects(107, {
  afterPlaying: (ctx) => {
    const p = ctx.choices.players?.[0];
    ctx.self.data.aweFirstPlayer = p ?? null;
    ctx.log(`Awe: no scoring this round — ${p ?? 'the current leader'} goes first next round.`);
  },
  cancelsRoundScoring: (ctx) => (ctx.self.data.playedRound as number | undefined) === ctx.state.round,
  chooseNextFirstPlayer: (ctx) => (ctx.self.data.aweFirstPlayer as PlayerId | undefined) ?? null,
});

// #108 Bliss — [2]. To play: discard a card from hand. While in play: score each of
// your moods sharing the discarded card's colour two extra times. The extra scoring
// is contributed via `scoreExtras` (applied during scoring, so the winner + logged
// scores reflect it). Bliss itself is always [2].
registerEffects(108, {
  canPlay: (ctx) => (ctx.state.hands[ctx.me]?.length ?? 0) >= 2, // Bliss + ≥1 other card
  payCost: (ctx) => {
    const hand = ctx.state.hands[ctx.me]!;
    const chosen = ctx.choices.cards?.[0];
    const c = chosen != null && chosen !== 108 ? chosen : hand.find((n) => n !== 108);
    if (c == null) return;
    ctx.self.data.blissColor = ctx.cardData(c).color;
    ctx.discardFromHand(ctx.me, c);
  },
  scoreExtras: (ctx) => {
    const col = ctx.self.data.blissColor as Color | undefined;
    if (!col) return [];
    let points = 0;
    // blissColor is the discarded card's printed colour; moods use in-play colour.
    for (const m of ctx.moodsOf(ctx.self.owner)) if (ctx.colorOf(m) === col) points += 2 * m.currentValue;
    return points ? [{ player: ctx.self.owner, points }] : [];
  },
});

// #109 Celebration — [3]/[6][1]=7 if more colours among your moods than among
// each other player's moods (strictly more than every opponent).
registerEffects(109, {
  intrinsicValue: (ctx) => {
    const me = ctx.self.owner;
    const mine = distinctColors(ctx, me);
    return ctx.opponentsOf(me).every((o) => mine > distinctColors(ctx, o)) ? 7 : 3;
  },
});

// #110 Cheer — [3]/[5]. Discard a hand card printed {0,2,4,6} (top-right) to make
// this [5]. (Value set per the authoritative MaRo Card Notes.)
registerEffects(110, {
  intrinsicValue: (ctx) => (ctx.self.data.boost ? 5 : 3),
  afterPlaying: (ctx) => {
    const c = ctx.choices.cards?.[0];
    if (c == null || ![0, 2, 4, 6].includes(ctx.cardData(c).value)) return;
    ctx.discardFromHand(ctx.me, c);
    ctx.self.data.boost = true;
  },
});

// #111 Delight — [3]/[5]. Discard a hand card printed {1,3,5} (top-right) to make
// this [5]. (Value set per the authoritative MaRo Card Notes.)
registerEffects(111, {
  intrinsicValue: (ctx) => (ctx.self.data.boost ? 5 : 3),
  afterPlaying: (ctx) => {
    const c = ctx.choices.cards?.[0];
    if (c == null || ![1, 3, 5].includes(ctx.cardData(c).value)) return;
    ctx.discardFromHand(ctx.me, c);
    ctx.self.data.boost = true;
  },
});

// #112 Determination — [3]/[6]=6 if three or more moods (anywhere) share a colour.
registerEffects(112, {
  intrinsicValue: (ctx) => (ALL_COLORS.some((c) => ctx.countColor(c) >= 3) ? 6 : 3),
});

// #113 Disregard — [6]/[3]=3 if two or more blue and/or black moods are in play.
registerEffects(113, {
  intrinsicValue: (ctx) => (ctx.countColor('blue') + ctx.countColor('black') >= 2 ? 3 : 6),
});

// #114 Eagerness — [2]. Play an additional mood this turn if it shares a colour with
// one of your moods. The extra play is a conditional grant constrained by
// `colorSharedWithControllerMoods`, so the engine only lets it be spent on a
// colour-matching card (Eagerness itself is green, so any green extra qualifies).
registerEffects(114, {
  afterPlaying: (ctx) => ctx.grantConditionalMood({ kind: 'colorSharedWithControllerMoods' }),
});

// #115 Enjoyment — [3]/[6]=6 if two or more red and/or white moods are in play.
registerEffects(115, {
  intrinsicValue: (ctx) => (ctx.countColor('red') + ctx.countColor('white') >= 2 ? 6 : 3),
});

// #116 Enthusiasm — [0]. While scoring, you may score one of your moods an extra
// time. Contributed via `scoreExtras`; since it's a "may" with free choice, it
// auto-scores the owner's highest-value mood again (the optimal pick).
registerEffects(116, {
  scoreExtras: (ctx) => {
    const mine = ctx.moodsOf(ctx.self.owner);
    if (mine.length === 0) return [];
    const best = Math.max(...mine.map((m) => m.currentValue));
    return best > 0 ? [{ player: ctx.self.owner, points: best }] : [];
  },
});

// #117 Euphoria — [0], +[1] for each mood in play (including itself and others).
// (Suppression forces 0, handled by the engine.)
registerEffects(117, {
  intrinsicValue: (ctx) => ctx.allMoods().length,
});

// #118 Fascination — [3]/[6][1]=7. Reveal a blue/black card from hand and give it
// to another player to make this [7].
registerEffects(118, {
  intrinsicValue: (ctx) => (ctx.self.data.boost ? 7 : 3),
  afterPlaying: (ctx) => {
    const c = ctx.choices.cards?.[0];
    const p = ctx.choices.players?.[0];
    if (c == null || !p) return;
    const col = ctx.cardData(c).color;
    if (col !== 'blue' && col !== 'black') return;
    const hand = ctx.state.hands[ctx.me]!;
    const i = hand.indexOf(c);
    if (i < 0) return;
    ctx.reveal(ctx.me, c); // public reveal line before giving the card away
    hand.splice(i, 1);
    (ctx.state.hands[p] ??= []).push(c);
    // The card was revealed publicly, so it stays face-up in the recipient's hand
    // (redactHand would otherwise conceal it). reconcileRevealed keeps it (the
    // recipient's count for c grew), so no stale entry is dropped.
    (ctx.state.revealed[p] ??= []).push(c);
    ctx.self.data.boost = true;
  },
});

// #119 Fondness — [0]/[6][1]=7 if each player has three or more moods.
registerEffects(119, {
  intrinsicValue: (ctx) => (ctx.state.players.every((p) => ctx.moodsOf(p.id).length >= 3) ? 7 : 0),
});

// #120 Generosity — [6]. Choose an opponent; they may play an additional mood on
// their next turn. The one-time grant is queued on the chosen opponent and folded
// into their play budget at the start of their next turn (see resetTurn).
registerEffects(120, {
  afterPlaying: (ctx) => {
    const p = ctx.choices.players?.[0];
    if (p && p !== ctx.me) ctx.grantExtraPlayNextTurn(p, 1);
  },
});

// #121 Grace — [0]. "While in play — During each of your turns (including the turn
// you play this mood) you may play an additional mood from the discard pile if it
// shares a colour with one of your moods." Recurring: `extraPlaysAtTurnStart` grants
// one colour-matched discard-play at the start of each of the owner's turns while
// Grace is in play; `afterPlaying` covers the turn Grace itself is played (turn start
// has passed by then). Both are conditional grants constrained by
// `colorSharedWithControllerMoods` with `from: 'discard'`, so the engine only lets the
// extra discard-play be spent on a discard card sharing a colour with one of your
// moods (Grace itself is green, so a green discard card always qualifies). The play is
// resolved via a { from: 'discard' } action.
registerEffects(121, {
  afterPlaying: (ctx) => ctx.grantConditionalMood({ kind: 'colorSharedWithControllerMoods' }, 'discard'),
  extraPlaysAtTurnStart: () => ({
    grants: [{ constraint: { kind: 'colorSharedWithControllerMoods' }, from: 'discard' }],
  }),
});

// #122 Happiness — [2]/[6][2]=8 if a single player has both a red mood and a
// white mood.
registerEffects(122, {
  intrinsicValue: (ctx) => {
    const has = ctx.state.players.some((p) => {
      const cols = new Set(ctx.moodsOf(p.id).map((m) => ctx.colorOf(m)));
      return cols.has('red') && cols.has('white');
    });
    return has ? 8 : 2;
  },
});

// #123 Harmony — [2]. "You may play an additional mood this turn FROM THE DISCARD
// PILE." Grants one discard-play (resolved via a { from: 'discard' } action).
registerEffects(123, {
  afterPlaying: (ctx) => ctx.grantDiscardMood(1),
});

// #124 Hope — [0]. "While in play — You may play an additional mood during each of
// your turns (including the turn you play this mood)." Recurring:
// `extraPlaysAtTurnStart` grants one extra play at the start of each of the owner's
// turns while Hope is in play (and stops once it leaves play); `afterPlaying` covers
// the turn Hope itself is played (turn start has already passed by then).
registerEffects(124, {
  afterPlaying: (ctx) => ctx.grantAdditionalMood(1),
  extraPlaysAtTurnStart: () => ({ normal: 1 }),
});

// #125 Joy — [3]. "After playing this mood — You may play an additional mood on your
// next turn." One-time: queues an extra play on the controller, folded into their
// play budget at the start of their next turn (see resetTurn).
registerEffects(125, {
  afterPlaying: (ctx) => ctx.grantExtraPlayNextTurn(ctx.me, 1),
});

// #126 Laziness — vanilla (no rules text). The engine scores its printed [4]; no
// entry needed.

// #127 Love (mythic) — [4]/[6][6]=12 if a white, blue, black, red, and green mood
// are all in play (including this one). Same effect as the #134 headliner below.
registerEffects(127, {
  intrinsicValue: (ctx) => (FIVE.every((c) => ctx.countColor(c) >= 1) ? 12 : 4),
});

// #128 Nostalgia — [0]. You may put a card from the discard pile into your hand;
// you may play an additional mood this turn (the additional mood is played from
// hand, so this is fully supported).
registerEffects(128, {
  afterPlaying: (ctx) => {
    const c = ctx.choices.cards?.[0];
    if (c != null) {
      const i = ctx.state.discard.indexOf(c);
      if (i >= 0) {
        ctx.state.discard.splice(i, 1);
        ctx.state.hands[ctx.me]!.push(c);
      }
    }
    ctx.grantAdditionalMood(1);
  },
});

// #129 Serenity — [3]/[6]=6 if you have an even number of moods (including this).
registerEffects(129, {
  intrinsicValue: (ctx) => (ctx.moodsOf(ctx.self.owner).length % 2 === 0 ? 6 : 3),
});

// #130 Sloth — [3], +[1] for each card in your hand. (Suppression forces 0.)
registerEffects(130, {
  intrinsicValue: (ctx) => 3 + (ctx.state.hands[ctx.self.owner]?.length ?? 0),
});

// #131 Tranquility — [3]/[6]=6 if you have an odd number of moods (including this).
registerEffects(131, {
  intrinsicValue: (ctx) => (ctx.moodsOf(ctx.self.owner).length % 2 === 1 ? 6 : 3),
});

// #132 Vulnerability — [1]/[6][1]=7 if a card was put into the discard pile THIS
// ROUND. Uses `state.discardedThisRound`, the per-round discard counter (reset each
// round), so a pile carrying cards from prior rounds no longer wrongly triggers it.
registerEffects(132, {
  intrinsicValue: (ctx) => (ctx.state.discardedThisRound > 0 ? 7 : 1),
});

// #133 Wonder — [0]. Choose a colour; +N for each mood of that colour and each
// card in the discard pile of that colour. (+[2] per, the authoritative MaRo Card
// Notes value.)
registerEffects(133, {
  afterPlaying: (ctx) => {
    const c = (ctx.choices.colors as Color[] | undefined)?.[0];
    if (c) ctx.self.data.wonderColor = c;
  },
  intrinsicValue: (ctx) => {
    const col = ctx.self.data.wonderColor as Color | undefined;
    if (!col) return 0;
    const discardN = ctx.state.discard.filter((n) => ctx.cardData(n).color === col).length;
    return (ctx.countColor(col) + discardN) * 2; // +[2] each (authoritative)
  },
});

// #134 Love (headliner foil) — [4]/[6][6]=12 if a white, blue, black, red, and
// green mood are all in play (including this one). Re-encoded here from the old
// cards/known/love.ts (which is removed during integration).
registerEffects(134, {
  intrinsicValue: (ctx) => (FIVE.every((c) => ctx.countColor(c) >= 1) ? 12 : 4),
});

// #135 Hurt Feelings — intentionally NOT encoded: it is the special 3+-player,
// non-scoring helper (value null) and is out of scope for this file.
