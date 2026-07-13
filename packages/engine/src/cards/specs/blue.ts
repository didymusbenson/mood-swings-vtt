// Target specs for blue cards (#27–#52). See ../choice-spec.ts and ./white.ts for
// the pattern. Only cards whose effect reads ctx.choices get a spec; pure grant/
// auto/intrinsic-value cards (#27, #30, #37, #39, #44, #45, #47) play immediately.
// Slots mirror exactly the choices fields each effect in ../blue.ts consumes.
//
// NOTE: #32 Creativity reads ctx.choices.option as an arbitrary card number to
// copy — "any card" is not expressible with the fixed slot kinds (mood/player/
// handCard/color/number/choice), so it gets no spec (see report).
import { registerSpec } from '../choice-spec.js';

// #28 Anxiety — up to two players each return one of their odd-value moods.
// (The "odd value" restriction is not expressible as a MoodFilter — see report.)
registerSpec(28, {
  slots: [
    { key: 'players', kind: 'player', min: 0, max: 2, players: 'all', label: 'Choose up to two players', optional: true },
    { key: 'moods', kind: 'mood', min: 0, max: 2, mood: { from: 'any' }, label: 'Choose which mood each returns', optional: true },
  ],
});

// #29 Avoidance — choose left/right; every player passes one mood that way.
registerSpec(29, {
  slots: [
    { key: 'option', kind: 'choice', min: 1, max: 1, options: ['left', 'right'], label: 'Pass moods left or right' },
    { key: 'moods', kind: 'mood', min: 0, max: 1, mood: { from: 'own' }, label: 'Choose which of your moods to pass', optional: true },
  ],
});

// #31 Confusion — choose left/right; every player passes one hand card that way.
registerSpec(31, {
  slots: [
    { key: 'option', kind: 'choice', min: 1, max: 1, options: ['left', 'right'], label: 'Pass cards left or right' },
    { key: 'cards', kind: 'handCard', min: 0, max: 1, label: 'Choose which card to pass', optional: true },
  ],
});

// #33 Curiosity — may choose a player to reveal a random hand card.
registerSpec(33, {
  slots: [{ key: 'players', kind: 'player', min: 0, max: 1, players: 'all', label: 'Choose a player to reveal (optional)', optional: true }],
});

// #34 Denial — may choose two other moods; if they match colour/value, both return.
registerSpec(34, {
  slots: [{ key: 'moods', kind: 'mood', min: 0, max: 2, mood: { from: 'any' }, label: 'Choose two moods (optional)', optional: true }],
});

// #35 Disorientation — may choose a value; every other mood with it returns.
registerSpec(35, {
  slots: [{ key: 'option', kind: 'number', min: 0, max: 1, numberRange: [0, 12], label: 'Choose a value (optional)', optional: true }],
});

// #36 Doubt — may reveal any number of hand cards, bottom-deck them, redraw.
registerSpec(36, {
  slots: [{ key: 'cards', kind: 'handCard', min: 0, max: 10, label: 'Choose cards to reveal (optional)', optional: true }],
});

// #38 Fear — may return one of your other moods to hand.
registerSpec(38, {
  slots: [{ key: 'moods', kind: 'mood', min: 0, max: 1, mood: { from: 'own' }, label: 'Return one of your moods (optional)', optional: true }],
});

// #40 Guile — To play: discard two cards. After: take one of your opponents' moods.
registerSpec(40, {
  slots: [
    { key: 'cards', kind: 'handCard', min: 2, max: 2, label: 'Discard two cards' },
    { key: 'moods', kind: 'mood', min: 1, max: 1, mood: { from: 'opponent' }, label: "Take an opponent's mood" },
  ],
});

// #41 Hesitation — may return one red/green mood, or all of them.
registerSpec(41, {
  slots: [
    { key: 'option', kind: 'choice', min: 0, max: 1, options: ['one', 'all'], label: 'Return one mood or all (optional)', optional: true },
    { key: 'moods', kind: 'mood', min: 0, max: 1, mood: { from: 'any', colorIn: ['red', 'green'] }, label: 'Choose a red/green mood (if "one")', optional: true },
  ],
});

// #42 Imagination — choose a colour; while in play all moods are that colour.
registerSpec(42, { slots: [{ key: 'colors', kind: 'color', min: 1, max: 1, label: 'Choose a colour' }] });

// #43 Indecisiveness — any number of 2+-mood opponents each return a random mood.
registerSpec(43, {
  slots: [{ key: 'players', kind: 'player', min: 0, max: 8, players: 'opponents', label: 'Choose opponents (optional)', optional: true }],
});

// #46 Neurosis — To play: return one or more of your moods to hand.
registerSpec(46, {
  slots: [{ key: 'moods', kind: 'mood', min: 1, max: 8, mood: { from: 'own' }, label: 'Return one or more of your moods' }],
});

// #48 Panic — up to two players each return one mood to hand.
registerSpec(48, {
  slots: [
    { key: 'players', kind: 'player', min: 0, max: 2, players: 'all', label: 'Choose up to two players', optional: true },
    { key: 'moods', kind: 'mood', min: 0, max: 2, mood: { from: 'any' }, label: 'Choose which mood each returns', optional: true },
  ],
});

// #49 Rationalization — may recycle your hand, or pass every hand left/right.
registerSpec(49, {
  slots: [{ key: 'option', kind: 'choice', min: 0, max: 1, options: ['recycle', 'left', 'right'], label: 'Recycle or pass hands (optional)', optional: true }],
});

// #50 Regret — To play: return two of your moods. After: take an opponent's mood.
// One 'moods' array: the two returned (own) plus the taken (opponent), so from:'any'.
registerSpec(50, {
  slots: [{ key: 'moods', kind: 'mood', min: 2, max: 3, mood: { from: 'any' }, label: "Return two of your moods, then take an opponent's" }],
});

// #51 Sneakiness — choose an opponent; swap scores after scoring.
registerSpec(51, {
  slots: [{ key: 'players', kind: 'player', min: 1, max: 1, players: 'opponents', label: 'Choose an opponent' }],
});

// #52 Worry — may return one white/black mood; if so, return up to two [3]-or-less moods.
// One 'moods' array: the white/black cost mood then the low-value targets — from:'any'.
registerSpec(52, {
  slots: [{ key: 'moods', kind: 'mood', min: 0, max: 3, mood: { from: 'any' }, label: 'Return a white/black mood, then up to two others (optional)', optional: true }],
});
