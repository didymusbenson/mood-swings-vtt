// Target specs for red cards (#80–#106). See ../choice-spec.ts and ./white.ts.
// Only cards whose effect reads ctx.choices get a spec; pure auto/intrinsic-value
// cards (#81, #83, #85, #88, #90, #92, #93, #97, #102, #104) play immediately.
// Slots mirror exactly the choices fields each effect in ../red.ts consumes.
//
// NOTE: #86 Compulsion's card comes from the TARGET player's hand, not the acting
// player's — its 'cards' slot is marked `handFrom: 'chosen'`, so legalTargets
// enumerates the hand of the player picked in the preceding 'players' slot. Value
// thresholds follow the effect CODE
// in ../red.ts (which uses the data/cards.json values, e.g. <=3 for Shock/Rage,
// total <=5 for Anger), not docs/card-notes.md.
import { registerSpec } from '../choice-spec.js';

// #80 Anger — may discard any number of moods whose TOTAL value is [5] or less.
// `maxTotalValue: 5` caps the running sum as moods are toggled (a per-candidate
// maxValue can't express the combination cap); the flow blocks a pick that would exceed it.
registerSpec(80, {
  slots: [{ key: 'moods', kind: 'mood', min: 0, max: 8, mood: { from: 'any', maxValue: 5, maxTotalValue: 5 }, label: 'Choose moods to discard — total value [5] or less (optional)', optional: true }],
});

// #82 Arrogance — may take an opponent's white/blue mood.
registerSpec(82, {
  slots: [{ key: 'moods', kind: 'mood', min: 0, max: 1, mood: { from: 'opponent', colorIn: ['white', 'blue'] }, label: "Take an opponent's white/blue mood (optional)", optional: true }],
});

// #84 Bravado — may discard one of your other moods to play an additional mood.
registerSpec(84, {
  slots: [{ key: 'moods', kind: 'mood', min: 0, max: 1, mood: { from: 'own' }, label: 'Discard one of your moods (optional)', optional: true }],
});

// #86 Compulsion — choose another player; they give you a card from their hand.
registerSpec(86, {
  slots: [
    { key: 'players', kind: 'player', min: 1, max: 1, players: 'opponents', label: 'Choose another player' },
    { key: 'cards', kind: 'handCard', min: 0, max: 1, cardsFrom: 'chosen', label: 'They choose a card to give', optional: true },
  ],
});

// #87 Embarrassment — may discard a printed [4]/[5]/[6] hand card to become [5].
registerSpec(87, {
  slots: [{ key: 'cards', kind: 'handCard', min: 0, max: 1, hand: { valueIn: [4, 5, 6] }, label: 'Discard a [4]–[6] card (optional)', optional: true }],
});

// #89 Exhilaration — To play: discard one of your moods.
registerSpec(89, {
  slots: [{ key: 'moods', kind: 'mood', min: 1, max: 1, mood: { from: 'own' }, label: 'Discard one of your moods' }],
});

// #91 Fury — each player discards one of their highest-value moods.
registerSpec(91, {
  slots: [{ key: 'moods', kind: 'mood', min: 0, max: 5, mood: { from: 'any' }, label: "Choose each player's highest mood to discard", optional: true }],
});

// #94 Hostility — may discard one of your black/green moods; if so, discard up to
// two [3]-or-less moods. One 'moods' array (sacrifice then targets), so from:'any'.
registerSpec(94, {
  slots: [{ key: 'moods', kind: 'mood', min: 0, max: 3, mood: { from: 'any' }, label: 'Discard a black/green mood, then up to two others (optional)', optional: true }],
});

// #95 Infatuation — may discard two of your other moods to become [6][3].
registerSpec(95, {
  slots: [{ key: 'moods', kind: 'mood', min: 0, max: 2, mood: { from: 'own' }, label: 'Discard two of your moods (optional)', optional: true }],
});

// #96 Instability — may choose two moods from one opponent; swap a mood each way.
// One 'moods' array: the two opponent moods, then the mood you give back — from:'any'.
registerSpec(96, {
  slots: [{ key: 'moods', kind: 'mood', min: 0, max: 2, mood: { from: 'any' }, label: "Take an opponent's mood, then give one of yours back (optional)", optional: true }],
});

// #98 Rage — may discard all other moods worth [3] or less (opt-in via option='all').
registerSpec(98, {
  slots: [{ key: 'option', kind: 'choice', min: 0, max: 1, options: ['all'], label: 'Discard all low-value moods (optional)', optional: true }],
});

// #99 Rebellion — choose [0]–[3]; discard all other moods with that value.
registerSpec(99, {
  slots: [{ key: 'option', kind: 'number', min: 1, max: 1, numberRange: [0, 3], label: 'Choose a value ([0]–[3])' }],
});

// #100 Recklessness — may take an opponent's mood (returned after scoring).
registerSpec(100, {
  slots: [{ key: 'moods', kind: 'mood', min: 0, max: 1, mood: { from: 'opponent' }, label: "Take an opponent's mood (optional)", optional: true }],
});

// #101 Shock — up to two players each discard a mood worth [3] or less.
registerSpec(101, {
  slots: [
    { key: 'players', kind: 'player', min: 0, max: 2, players: 'all', label: 'Choose up to two players', optional: true },
    { key: 'moods', kind: 'mood', min: 0, max: 2, mood: { from: 'chosen', maxValue: 3 }, selfTargetable: true, label: 'Choose which [3]-or-less mood each discards', optional: true },
  ],
});

// #103 Thrill — may return any number of your other moods to hand to replay them.
registerSpec(103, {
  slots: [{ key: 'moods', kind: 'mood', min: 0, max: 8, mood: { from: 'own' }, label: 'Return your moods to hand (optional)', optional: true }],
});

// #105 Wrath — may discard all other moods (opt-in via option='all').
registerSpec(105, {
  slots: [{ key: 'option', kind: 'choice', min: 0, max: 1, options: ['all'], label: 'Discard all other moods (optional)', optional: true }],
});

// #106 Zeal — may bottom-deck a hand card and draw.
registerSpec(106, {
  slots: [{ key: 'cards', kind: 'handCard', min: 0, max: 1, label: 'Bottom-deck a card (optional)', optional: true }],
});
