// Target specs for white cards (#1–#26). See ../choice-spec.ts. Only cards that
// take interactive targets get a spec; others (grants/auto effects) are omitted
// and play immediately. Slots must match what the effect reads from ctx.choices.
import { registerSpec } from '../choice-spec.js';

// #6 Conviction — choose any mood; its owner bottom-decks it and draws. Conviction is
// in play when this resolves, so it may choose itself (selfTargetable).
registerSpec(6, { slots: [{ key: 'moods', kind: 'mood', min: 1, max: 1, mood: { from: 'any' }, selfTargetable: true, label: 'Choose a mood' }] });

// #7 Courage — up to two players each lose a [5]+ mood. The mood slot lets you pick
// which qualifying mood each chosen player loses (the effect already reads it, falling
// back to their first [5]+ mood); selfTargetable so a chosen self can lose a buffed
// just-played Courage. Skipping the slot keeps the auto-pick behaviour.
registerSpec(7, {
  slots: [
    { key: 'players', kind: 'player', min: 0, max: 2, players: 'all', label: 'Choose up to two players', optional: true },
    { key: 'moods', kind: 'mood', min: 0, max: 2, mood: { from: 'any', minValue: 5 }, selfTargetable: true, label: 'Choose which [5]-or-more mood each loses', optional: true },
  ],
});

// #8 Dignity — may discard a hand card printed [0]/[1]/[2]/[3] to become [5].
registerSpec(8, {
  slots: [{ key: 'cards', kind: 'handCard', min: 0, max: 1, hand: { valueIn: [0, 1, 2, 3] }, label: 'Discard a [0]–[3] card (optional)', optional: true }],
});

// #10 Disillusionment — choose colour(s); other moods of those colours are discarded.
registerSpec(10, { slots: [{ key: 'colors', kind: 'color', min: 0, max: 5, label: 'Choose colour(s)', optional: true }] });

// #11 Encouragement — choose a mood with a secondary value.
registerSpec(11, {
  slots: [{ key: 'moods', kind: 'mood', min: 0, max: 1, mood: { from: 'any', hasSecondary: true }, label: 'Choose a mood with a secondary value', optional: true }],
});

// #12 Faith — discard a green/blue card, then suppress any mood.
registerSpec(12, {
  slots: [
    { key: 'cards', kind: 'handCard', min: 0, max: 1, hand: { colorIn: ['green', 'blue'] }, label: 'Discard a green/blue card (optional)', optional: true },
    { key: 'moods', kind: 'mood', min: 0, max: 1, mood: { from: 'any' }, selfTargetable: true, label: 'Suppress a mood' },
  ],
});

// #14 Guilt — suppress one black/red mood, or all of them.
registerSpec(14, {
  slots: [
    { key: 'option', kind: 'choice', min: 1, max: 1, options: ['one', 'all'], label: 'Suppress one mood or all' },
    { key: 'moods', kind: 'mood', min: 0, max: 1, mood: { from: 'any', colorIn: ['black', 'red'] }, label: 'Choose a black/red mood (if "one")', optional: true },
  ],
});

// #15 Honor — choose a player to lead each round.
registerSpec(15, { slots: [{ key: 'players', kind: 'player', min: 1, max: 1, players: 'all', label: 'Choose a player' }] });

// #20 Pacifism — up to two players each have a mood suppressed.
registerSpec(20, { slots: [{ key: 'moods', kind: 'mood', min: 0, max: 2, mood: { from: 'opponent' }, label: 'Suppress up to two moods', optional: true }] });

// #22 Pride — choose a player who has more moods than you.
registerSpec(22, { slots: [{ key: 'players', kind: 'player', min: 0, max: 1, players: 'opponents', label: 'Choose a player with more moods', optional: true }] });

// #23 Repentance — choose a value; suppress all other moods with it.
registerSpec(23, { slots: [{ key: 'option', kind: 'number', min: 0, max: 1, numberRange: [0, 12], label: 'Choose a value', optional: true }] });

// #24 Scorn — suppress any mood (may be Scorn itself; it is in play by now).
registerSpec(24, { slots: [{ key: 'moods', kind: 'mood', min: 0, max: 1, mood: { from: 'any' }, selfTargetable: true, label: 'Suppress a mood', optional: true }] });

// #25 Shame — discard a card; suppress other moods sharing its colour.
registerSpec(25, { slots: [{ key: 'cards', kind: 'handCard', min: 0, max: 1, label: 'Discard a card (optional)', optional: true }] });
