// Target specs for green cards (#107–#134). See ../choice-spec.ts and ./white.ts.
// Only cards whose effect reads ctx.choices get a spec. Cards with no player decision
// — pure intrinsic-value or automatic effects (#109, #112, #113, #114, #115, #116,
// #117, #119, #122, #124, #125, #126, #127, #129, #130, #131, #132, #134) — need no
// spec and play immediately. Slots mirror the choices each effect in ../green.ts reads.
//
// NOTE: #128 Nostalgia recovers a card from the DISCARD pile — its 'cards' slot is
// marked `cardsFrom: 'discard'` so legalTargets enumerates the discard pile. #118
// Fascination gives away one of the ACTING player's own cards (default source is
// correct). #121 Grace / #123 Harmony grant a discard-play with no play-time chooser.
// Hand-card value filters follow the effect CODE in ../green.ts (matches cards.json).
import { registerSpec } from '../choice-spec.js';

// #107 Awe — you choose which player goes first next round.
registerSpec(107, {
  slots: [{ key: 'players', kind: 'player', min: 1, max: 1, players: 'all', label: 'Choose who goes first next round' }],
});

// #108 Bliss — To play: discard a card; your moods of its colour score twice more.
registerSpec(108, {
  slots: [{ key: 'cards', kind: 'handCard', min: 1, max: 1, label: 'Discard a card' }],
});

// #110 Cheer — may discard a printed [0]/[2]/[4]/[6] hand card to become [5].
registerSpec(110, {
  slots: [{ key: 'cards', kind: 'handCard', min: 0, max: 1, hand: { valueIn: [0, 2, 4, 6] }, label: 'Discard a [0]/[2]/[4]/[6] card (optional)', optional: true }],
});

// #111 Delight — may discard a printed [1]/[3]/[5] hand card to become [5].
registerSpec(111, {
  slots: [{ key: 'cards', kind: 'handCard', min: 0, max: 1, hand: { valueIn: [1, 3, 5] }, label: 'Discard a [1]/[3]/[5] card (optional)', optional: true }],
});

// #118 Fascination — may reveal a blue/black card and give it to another player.
registerSpec(118, {
  slots: [
    { key: 'cards', kind: 'handCard', min: 0, max: 1, hand: { colorIn: ['blue', 'black'] }, label: 'Reveal a blue/black card (optional)', optional: true },
    { key: 'players', kind: 'player', min: 0, max: 1, players: 'opponents', label: 'Choose a player to give it to', optional: true },
  ],
});

// #120 Generosity — choose an opponent (they may play an additional mood next turn).
registerSpec(120, {
  slots: [{ key: 'players', kind: 'player', min: 1, max: 1, players: 'opponents', label: 'Choose an opponent' }],
});

// #121 Grace / #123 Harmony — play with no targets; they grant a discard-play that
// is surfaced as a separate { from: 'discard' } action (UI hookup out of scope), so
// they need no play-time target spec.

// #128 Nostalgia — may put a discard card into your hand, then play an additional mood.
registerSpec(128, {
  slots: [{ key: 'cards', kind: 'handCard', min: 0, max: 1, cardsFrom: 'discard', label: 'Take a discard card (optional)', optional: true }],
});

// #133 Wonder — choose a colour; +[2] per mood/discard card of that colour.
registerSpec(133, { slots: [{ key: 'colors', kind: 'color', min: 1, max: 1, label: 'Choose a colour' }] });
