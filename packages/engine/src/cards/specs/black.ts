// Target specs for black cards (#53–#79). See ../choice-spec.ts and ./white.ts.
// Only cards whose effect reads ctx.choices get a spec; pure auto/intrinsic-value
// cards (#55, #57, #63, #65, #69, #70, #72, #74, #77, #79) play immediately.
// Slots mirror exactly the choices fields each effect in ../black.ts consumes.
//
// NOTE on card sources: a 'handCard' slot's `cardsFrom` picks the pile it enumerates —
// 'acting' (default, the acting player's hand), 'chosen' (the hand(s) of player(s)
// picked in a preceding 'players' slot: #67 an opponent's hand, #78 each targeted
// player's own hand), or 'discard' (the shared discard pile: #60 Corruption recovers,
// #62 Cynicism moves a discard card into an opponent's hand).
import { registerSpec } from '../choice-spec.js';

// #53 Ambition — may discard a hand card to play an additional mood.
registerSpec(53, {
  slots: [{ key: 'cards', kind: 'handCard', min: 0, max: 1, label: 'Discard a card (optional)', optional: true }],
});

// #54 Angst — may discard one of your blue/red moods to replay from the discard.
registerSpec(54, {
  slots: [{ key: 'moods', kind: 'mood', min: 0, max: 1, mood: { from: 'own', colorIn: ['blue', 'red'] }, label: 'Discard a blue/red mood (optional)', optional: true }],
});

// #56 Betrayal — give one of your moods to another player.
registerSpec(56, {
  slots: [
    { key: 'moods', kind: 'mood', min: 1, max: 1, mood: { from: 'own' }, label: 'Choose one of your moods' },
    { key: 'players', kind: 'player', min: 1, max: 1, players: 'opponents', label: 'Choose a player to give it to' },
  ],
});

// #58 Condescension — may give a hand card to another player to become [6].
registerSpec(58, {
  slots: [
    { key: 'cards', kind: 'handCard', min: 0, max: 1, label: 'Give a card (optional)', optional: true },
    { key: 'players', kind: 'player', min: 0, max: 1, players: 'opponents', label: 'Choose a player to give it to', optional: true },
  ],
});

// #59 Contempt — may discard one green/white mood, or all of them.
registerSpec(59, {
  slots: [
    { key: 'option', kind: 'choice', min: 0, max: 1, options: ['one', 'all'], label: 'Discard one mood or all (optional)', optional: true },
    { key: 'moods', kind: 'mood', min: 0, max: 1, mood: { from: 'any', colorIn: ['green', 'white'] }, label: 'Choose a green/white mood (if "one")', optional: true, showWhen: { option: ['one'] } },
  ],
});

// #60 Corruption — choose one: bottom-deck up to two discard cards & draw, or double-win.
registerSpec(60, {
  slots: [
    { key: 'option', kind: 'choice', min: 1, max: 1, options: ['cards', 'wins'], label: 'Recover cards or double the win' },
    { key: 'cards', kind: 'handCard', min: 0, max: 2, cardsFrom: 'discard', label: 'Choose up to two discard cards (if "cards")', optional: true, showWhen: { option: ['cards'] } },
  ],
});

// #61 Cruelty — any number of 2+-mood opponents each discard a random mood.
registerSpec(61, {
  slots: [{ key: 'players', kind: 'player', min: 0, max: 8, players: 'opponents', label: 'Choose opponents (optional)', optional: true }],
});

// #62 Cynicism — may move a discard card into an opponent's hand to become [6].
registerSpec(62, {
  slots: [
    { key: 'cards', kind: 'handCard', min: 0, max: 1, cardsFrom: 'discard', label: 'Choose a discard card (optional)', optional: true },
    { key: 'players', kind: 'player', min: 0, max: 1, players: 'opponents', label: 'Choose an opponent', optional: true },
  ],
});

// #64 Envy — To play: discard one of your moods.
registerSpec(64, {
  slots: [{ key: 'moods', kind: 'mood', min: 1, max: 1, mood: { from: 'own' }, label: 'Discard one of your moods' }],
});

// #66 Hate — may bottom-deck any mood and draw (may be Hate itself; it is in play now).
registerSpec(66, {
  slots: [{ key: 'moods', kind: 'mood', min: 0, max: 1, mood: { from: 'any' }, selfTargetable: true, label: 'Bottom-deck a mood (optional)', optional: true }],
});

// #67 Intimidation — may take a revealed card from another player and play it.
registerSpec(67, {
  slots: [
    { key: 'players', kind: 'player', min: 0, max: 1, players: 'opponents', label: 'Choose an opponent (optional)', optional: true },
    { key: 'cards', kind: 'handCard', min: 0, max: 1, cardsFrom: 'chosen', label: 'Choose a card from their hand', optional: true },
  ],
});

// #68 Malice — a chosen 2+-mood player picks two of their moods; those + colour-matches discard.
registerSpec(68, {
  slots: [
    { key: 'players', kind: 'player', min: 1, max: 1, players: 'all', label: 'Choose a player with 2+ moods' },
    { key: 'moods', kind: 'mood', min: 0, max: 2, mood: { from: 'any' }, label: 'That player chooses two of their moods', optional: true },
  ],
});

// #71 Paranoia — may make a player reveal a random hand card, bottom-deck it, then draw.
registerSpec(71, {
  slots: [{ key: 'players', kind: 'player', min: 0, max: 1, players: 'all', label: 'Choose a player (optional)', optional: true }],
});

// #73 Rejection — may pick two other moods; if they match colour/value, discard both.
registerSpec(73, {
  slots: [{ key: 'moods', kind: 'mood', min: 0, max: 2, mood: { from: 'any' }, label: 'Choose two moods (optional)', optional: true }],
});

// #75 Self-Loathing — To play: discard one or more of your moods.
registerSpec(75, {
  slots: [{ key: 'moods', kind: 'mood', min: 1, max: 8, mood: { from: 'own' }, label: 'Discard one or more of your moods' }],
});

// #76 Spite — up to two players each discard an even-value mood.
registerSpec(76, {
  slots: [
    { key: 'players', kind: 'player', min: 0, max: 2, players: 'all', label: 'Choose up to two players', optional: true },
    { key: 'moods', kind: 'mood', min: 0, max: 2, mood: { from: 'any', valueParity: 'even' }, selfTargetable: true, label: 'Choose which even-value mood each discards', optional: true },
  ],
});

// #78 Suspicion — each chosen player discards a card from their hand.
registerSpec(78, {
  slots: [
    { key: 'players', kind: 'player', min: 0, max: 8, players: 'all', label: 'Choose players (optional)', optional: true },
    { key: 'cards', kind: 'handCard', min: 0, max: 8, cardsFrom: 'chosen', label: 'Choose which card each discards', optional: true },
  ],
});
