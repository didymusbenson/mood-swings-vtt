// Prebuilt test decks — a curated suite that seeds recognisable game scenarios
// without relying on the random box-collation generator.
//
// GOAL: cover every playable card (all 133) across the suite while packing each
// deck so a card's *nuance actually fires* — conditional cards are grouped with
// the enablers they need (discard fodder, the right on-board colours, high/low
// value bodies, extra-mood grants, a live opponent, etc.). Cards with no special
// needs (the five value-4 vanillas, and other "self-contained" bodies) float in
// as filler where a slot is needed to supply a colour or a body.
//
// SHAPE: each deck is 5 distinct moods at `PRESET_COPIES` copies = a 15-card
// deck (the two-player minimum). Because every mood runs 3 copies, any
// "2+ of colour X" / "3+ of one colour" condition is satisfied simply by the
// deck *containing* a mood of that colour — which is how the colour-count decks
// below are built.
//
// Enabler cards intentionally recur across decks: the same body (e.g. a vanilla,
// or a 0-value 0-drop) legitimately powers different scenarios. The invariant we
// guarantee is COVERAGE — the union of every deck's moods is all 133 playable
// cards. See presetDecks.test.ts, which asserts exactly that.

import type { DeckCounts } from './deckModel.js';

/** Copies of each of a preset's five moods. 5 × 3 = 15 = two-player minimum. */
export const PRESET_COPIES = 3;

export interface PresetDeck {
  /** Stable id used as the picker option value (prefixed `preset:` in the UI). */
  id: string;
  /** Short display name. */
  name: string;
  /** What scenario this deck is built to exercise. */
  description: string;
  /** The five distinct collector numbers. Expanded to `PRESET_COPIES` each. */
  moods: [number, number, number, number, number];
}

// Card-number reference (names in comments are validated by presetDecks.test.ts
// against the card db, so a typo'd grouping fails the build rather than shipping).
export const PRESET_DECKS: PresetDeck[] = [
  // ── Black ────────────────────────────────────────────────────────────────
  {
    id: 'black-discard-mill',
    name: 'Discard Mill (Black)',
    description:
      'Self-Loathing sacrifices your own moods to stock the discard pile; Sadness/Misery scale off it and Grief/Melancholy replay from it.',
    moods: [75, 74, 70, 65, 69], // Self-Loathing, Sadness, Misery, Grief, Melancholy
  },
  {
    id: 'black-corruption',
    name: 'Corruption & Discard (Black)',
    description:
      'Envy and Cruelty feed the discard pile and an opponent board; Corruption and Cynicism cash the discard in, Bitterness punishes the common colour.',
    moods: [64, 60, 62, 61, 57], // Envy, Corruption, Cynicism, Cruelty, Bitterness
  },
  {
    id: 'black-go-wide',
    name: 'Go Wide (Black)',
    description:
      'Ambition floods your side with extra moods so Superiority, Vanity and Malice reward the biggest board; Hate is a self-targeting filler.',
    moods: [53, 77, 79, 68, 66], // Ambition, Superiority, Vanity, Malice, Hate
  },
  {
    id: 'black-value-targeting',
    name: 'Value Targeting (Black)',
    description:
      'Spite hits even-value moods, Rejection matches colour/value duplicates, Paranoia/Suspicion mine hands; Apathy supplies an even-value body.',
    moods: [76, 73, 71, 78, 55], // Spite, Rejection, Paranoia, Suspicion, Apathy
  },
  {
    id: 'opponent-harassment',
    name: 'Opponent Harassment (Black/Blue)',
    description:
      'Everything preys on a live opponent — Betrayal, Condescension and Intimidation on their board/hand, Guile and Sneakiness on their moods and score.',
    moods: [56, 58, 67, 40, 51], // Betrayal, Condescension, Intimidation, Guile, Sneakiness
  },
  {
    id: 'bounce-replay',
    name: 'Bounce & Replay (Black/Blue/Red)',
    description:
      'Angst wants your own blue/red mood plus a mood in the discard to replay; Anxiety/Panic bounce odd and arbitrary moods, Rage/Anger clear low ones.',
    moods: [54, 28, 98, 48, 80], // Angst, Anxiety, Rage, Panic, Anger
  },

  // ── Colour-count (rainbow bodies) ─────────────────────────────────────────
  {
    id: 'color-upgrades',
    name: 'Colour-Count Upgrades (Rainbow)',
    description:
      'Every card jumps in value off the colours present: Obsession (white/black), Pity (blue/red), Excitement (black/green), Enjoyment (red/white), Determination (3 of a colour).',
    moods: [47, 72, 88, 115, 112], // Obsession, Pity, Excitement, Enjoyment, Determination
  },
  {
    id: 'color-downgrades',
    name: 'Colour-Count Downgrades (Rainbow)',
    description:
      'A full-rainbow board so every "drops to [3]" clause fires: Discipline (black/red), Ambivalence (red/green), Disgust (green/white), Frustration (white/blue), Disregard (blue/black).',
    moods: [9, 27, 63, 90, 113], // Discipline, Ambivalence, Disgust, Frustration, Disregard
  },
  {
    id: 'suppression-politics',
    name: 'Suppression & Colour Politics (Rainbow)',
    description:
      'Guilt and Hesitation suppress/return by colour, Contempt targets green/white, Happiness needs red+white, Fury makes every player dump their best — a live-board rainbow.',
    moods: [14, 41, 59, 91, 122], // Guilt, Hesitation, Contempt, Fury, Happiness
  },

  // ── White ────────────────────────────────────────────────────────────────
  {
    id: 'white-discard',
    name: 'Discard & Redistribute (White)',
    description:
      'Dignity, Shame and Disillusionment push cards to the discard pile so Altruism finds it populated; Charity is a free extra mood.',
    moods: [1, 8, 10, 25, 3], // Altruism, Dignity, Disillusionment, Shame, Charity
  },
  {
    id: 'white-high-value',
    name: 'High Value & Suppression (White)',
    description:
      'Neurosis (prints [5]) and an aging Patience give Courage and Meekness the [5]+ moods they punish; Scorn suppresses same-colour follow-ups.',
    moods: [7, 19, 21, 24, 46], // Courage, Meekness, Patience, Scorn, Neurosis
  },
  {
    id: 'white-secondary',
    name: 'Secondary Values & Grants (White)',
    description:
      'Chivalry, Idealism and Loyalty carry secondary values for Encouragement/Idealism to boost; Kindness and Friendliness grant extra moods off odd/even cards in hand.',
    moods: [11, 16, 13, 17, 4], // Encouragement, Idealism, Friendliness, Kindness, Chivalry
  },
  {
    id: 'white-politics',
    name: 'Politics & Suppression (White)',
    description:
      'Honor rigs turn order, Pride and Pacifism prey on an opponent board, Conviction and Repentance bottom-deck and suppress by value.',
    moods: [15, 22, 20, 6, 23], // Honor, Pride, Pacifism, Conviction, Repentance
  },
  {
    id: 'white-chains',
    name: 'Extra-Mood Chains (White/Rainbow)',
    description:
      'Fear and Hope are [0] moods that chain Validation and satisfy Benevolence (off-colour in hand) and Faith (blue/green to discard).',
    moods: [26, 12, 2, 38, 124], // Validation, Faith, Benevolence, Fear, Hope
  },

  // ── Blue ─────────────────────────────────────────────────────────────────
  {
    id: 'blue-bounce',
    name: 'Return & Value-Match (Blue)',
    description:
      'Imagination recolours the whole board so Fickleness, Denial and Curiosity find their colour matches; Disorientation catches the shared value.',
    moods: [34, 35, 39, 33, 42], // Denial, Disorientation, Fickleness, Curiosity, Imagination
  },
  {
    id: 'blue-chains',
    name: 'Extra Moods & Theft (Blue)',
    description:
      'Duplicity and Insecurity grant extra moods to build a board; Regret and Indecisiveness need those stacked moods, Creativity copies the best one down.',
    moods: [37, 45, 50, 43, 32], // Duplicity, Insecurity, Regret, Indecisiveness, Creativity
  },
  {
    id: 'blue-disruption',
    name: 'Hand Disruption (Blue)',
    description:
      'Confusion and Rationalization pass hands, Doubt reveals and bans a colour, Avoidance passes moods, Bashfulness rewards winning the turn it lands.',
    moods: [29, 31, 36, 49, 30], // Avoidance, Confusion, Doubt, Rationalization, Bashfulness
  },
  {
    id: 'blue-tempo',
    name: 'Tempo & Doubling (White/Blue/Green)',
    description:
      'Loyalty rises off blue/green bodies, Worry pays a white/black mood to bounce low ones, Bliss doubles a colour; Indifference/Nostalgia are the bodies.',
    moods: [18, 52, 44, 108, 128], // Loyalty, Worry, Indifference, Bliss, Nostalgia
  },

  // ── Red ──────────────────────────────────────────────────────────────────
  {
    id: 'red-wipe',
    name: 'Board Wipes (Red)',
    description:
      'Wrath clears every other mood, Rebellion and Shock hit shared/low values, Chaos reshuffles the board, Glee spikes to [6] the round it drops.',
    moods: [105, 99, 101, 85, 92], // Wrath, Rebellion, Shock, Chaos, Glee
  },
  {
    id: 'red-sacrifice',
    name: 'Own-Board Sacrifice (Red)',
    description:
      'Every card eats your own moods for value — Exhilaration doubles them, Infatuation sacs two for [9], Thrill bounces for replays, Bravado/Instability trade.',
    moods: [89, 95, 103, 84, 96], // Exhilaration, Infatuation, Thrill, Bravado, Instability
  },
  {
    id: 'red-pressure',
    name: 'Opponent Pressure (Red)',
    description:
      'Animosity, Arrogance, Compulsion, Passion and Recklessness all key off an opponent with moods and a full hand; Indifference seeds a blue body for Arrogance.',
    moods: [81, 82, 86, 97, 44], // Animosity, Arrogance, Compulsion, Passion, Indifference
  },
  {
    id: 'red-hand',
    name: 'Hand Manipulation (Red)',
    description:
      'Embarrassment needs a printed [4]+ card in hand (Boredom supplies it), Gluttony/Zeal spend spare cards, Stubbornness rides being behind on moods.',
    moods: [87, 93, 106, 102, 83], // Embarrassment, Gluttony, Zeal, Stubbornness, Boredom
  },
  {
    id: 'red-sacrifice-steal',
    name: 'Sacrifice & Steal (Red/Green/Black)',
    description:
      'Hostility sacrifices a black/green mood (Apathy/Hope) to shrink low targets, Recklessness steals a mood, Triumph rewards going first.',
    moods: [94, 100, 104, 124, 55], // Hostility, Recklessness, Triumph, Hope, Apathy
  },

  // ── Green ────────────────────────────────────────────────────────────────
  {
    id: 'green-discard',
    name: 'Discard Engine (Green)',
    description:
      'Cheer and Delight discard even/odd cards to seed the pile; Grace and Harmony replay from it, Vulnerability spikes to [7] off a same-round discard.',
    moods: [110, 111, 121, 123, 132], // Cheer, Delight, Grace, Harmony, Vulnerability
  },
  {
    id: 'green-count',
    name: 'Count & Parity (Green)',
    description:
      'Flood the board with green: Euphoria scales with mood count, Serenity/Tranquility swing on even/odd, Enthusiasm doubles your best, Wonder counts a colour.',
    moods: [116, 117, 129, 131, 133], // Enthusiasm, Euphoria, Serenity, Tranquility, Wonder
  },
  {
    id: 'green-extra-plays',
    name: 'Extra Plays (Green/Blue)',
    description:
      'Eagerness, Joy and Generosity grant extra plays that flood every side to 3+ moods — which is exactly what Fondness ([0]→[7]) needs; Sloth scales off a deep hand.',
    moods: [114, 125, 130, 120, 119], // Eagerness, Joy, Sloth, Generosity, Fondness
  },
  {
    id: 'green-scoring-tricks',
    name: 'Scoring Tricks (Green/Black)',
    description:
      'Awe cancels a round of scoring and re-picks first player; Fascination hands a blue/black card (Apathy) to an opponent; Bliss/Nostalgia work the discard.',
    moods: [107, 118, 108, 128, 55], // Awe, Fascination, Bliss, Nostalgia, Apathy
  },

  // ── Rainbow marquee ──────────────────────────────────────────────────────
  {
    id: 'rainbow-love',
    name: 'Five-Colour Payoff (Love)',
    description:
      'One mood of every colour so Love sees all five and hits [12]; the four value-4 vanillas are the clean rainbow bodies.',
    moods: [5, 44, 55, 83, 127], // Complacency, Indifference, Apathy, Boredom, Love
  },
  {
    id: 'color-diversity',
    name: 'Colour Diversity (Rainbow)',
    description:
      'Celebration rewards controlling more colours than the opponent; four colours of cheap [0] bodies (Idealism/Fear/Sadness) plus Laziness make the spread.',
    moods: [109, 126, 16, 38, 74], // Celebration, Laziness, Idealism, Fear, Sadness
  },
];

/** Expand a preset into a `PRESET_COPIES`-per-mood count map. */
export function presetCounts(p: PresetDeck): DeckCounts {
  const counts: DeckCounts = new Map();
  for (const n of p.moods) counts.set(n, PRESET_COPIES);
  return counts;
}

/** Expand a preset into the engine's flat `number[]` (ascending, repeats = copies). */
export function presetFlat(p: PresetDeck): number[] {
  const out: number[] = [];
  for (const n of [...p.moods].sort((a, b) => a - b)) {
    for (let i = 0; i < PRESET_COPIES; i++) out.push(n);
  }
  return out;
}

/** Look up a preset by id. */
export function presetById(id: string): PresetDeck | undefined {
  return PRESET_DECKS.find((d) => d.id === id);
}
