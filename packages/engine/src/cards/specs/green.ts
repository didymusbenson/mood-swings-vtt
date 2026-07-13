// Target specs for green cards (#107–#134). See ../choice-spec.ts and ./white.ts.
// Only cards whose effect reads ctx.choices get a spec; pure auto/intrinsic-value
// and best-effort/unsupported cards without a choice (#109, #112, #113, #114, #115,
// #116, #117, #119, #122, #124, #125, #126, #127, #129, #130, #131, #132, #134)
// play immediately. Slots mirror the choices fields each effect in ../green.ts reads.
//
// NOTE: #121 Grace, #123 Harmony, and #128 Nostalgia read choices.cards from the
// DISCARD pile, and #118 Fascination gives a card to another player; slot kind
// 'handCard' carries the 'cards' field but legalTargets enumerates the acting
// player's hand, not the discard pile (see report). Hand-card value filters follow
// the effect CODE in ../green.ts (which matches the data/cards.json rules text).
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

// #121 Grace — may play an additional colour-matching mood from the discard pile.
registerSpec(121, {
  slots: [{ key: 'cards', kind: 'handCard', min: 0, max: 1, label: 'Choose a discard card (optional)', optional: true }],
});

// #123 Harmony — may play an additional mood from the discard pile.
registerSpec(123, {
  slots: [{ key: 'cards', kind: 'handCard', min: 0, max: 1, label: 'Choose a discard card (optional)', optional: true }],
});

// #128 Nostalgia — may put a discard card into your hand, then play an additional mood.
registerSpec(128, {
  slots: [{ key: 'cards', kind: 'handCard', min: 0, max: 1, label: 'Take a discard card (optional)', optional: true }],
});

// #133 Wonder — choose a colour; +[2] per mood/discard card of that colour.
registerSpec(133, { slots: [{ key: 'colors', kind: 'color', min: 1, max: 1, label: 'Choose a colour' }] });
