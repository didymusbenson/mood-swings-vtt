# Encoding card effects (author's guide)

Each card's behaviour is a `CardEffects` object registered by collector number.
Static data (value, colour, secondary, rules text) comes from `data/cards.json`;
you only write **behaviour**. Rules edge-cases are in `docs/card-notes.md` — read
the note for any card you encode. The canonical interface is
`packages/engine/src/effects.ts`; `packages/engine/src/cards/white.ts` is the
reference implementation — mirror its style.

## Registering

```ts
import { registerEffects } from './registry.js';
registerEffects(42, { /* hooks */ });
```

Put all cards for a colour in one file (`blue.ts`, `black.ts`, …) and import it
from `cards/index.ts`. A card with no rules text (the 5 vanillas) needs **no**
entry — the engine scores its printed value by default.

## Hooks (all optional)

- `intrinsicValue(ctx) => number` — this mood's value from board state, before
  other moods' modifiers. Use for "This mood's value is X if …". Defaults to the
  printed primary (or secondary if rotated).
- `whileInPlay(ctx) => ValueModifier[]` — continuous modifiers this mood imposes
  on moods in play. `ValueModifier = { appliesTo(mood, ctx): boolean; op }` where
  `op` is `{kind:'add',n}`, `{kind:'set',n}`, or `{kind:'max',n}` (value becomes
  max(current, n) — used for "higher of top-right/lower-left").
- `canPlay(ctx) => boolean` — "To play this card" gate (return false if the cost
  can't be paid). `payCost(ctx)` — pay it (runs before the mood enters play).
- `afterPlaying(ctx)` — "After playing this mood".
- `afterScoring(ctx)` — end-of-round, in turn order (before losers draw).
- `onOtherMoodPlayed(ctx, played)` — fires when the controller plays a later mood
  ("each time you play another mood": Scorn, Validation).
- `forcesFirstPlayer(ctx) => PlayerId | null` — force who leads the round (Honor).

## Context

`ReadContext` (all hooks): `state`, `self` (this mood), `card(mood)`,
`cardData(n)`, `valueOf(mood)`, `allMoods()`, `moodsOf(pid)`, `opponentsOf(pid)`,
`countColor(color)`, `mostCommonColors()`, `moodiest()`.

`PlayContext`/`ScoreContext` add mutations: `me` (acting player), `choices`,
`discardMoodToPile`, `returnMoodToHand`, `discardFromHand(player, cardNumber)`,
`draw(player, n?)`, `putOnBottomOfDeck`, `suppress(mood, 'turn'|'round'|'sustained', bySelf?)`,
`steal(mood, to)`, `giveMood(mood, to)`, `rotateToSecondary(mood, on?)`,
`grantAdditionalMood(n?)`, `grantConditionalMood(constraint)`, `random(maxExclusive)`,
`log`.

`grantConditionalMood` constraints (serializable): `{kind:'primaryValueIn',values}`,
`{kind:'colorNotSharedWithControllerMoods'}`, `{kind:'whileMoodCountBelow',target}`.

## Choices convention

Player decisions arrive on `ctx.choices` (all optional; absent → decline a "may"):
`moods: string[]` (target mood uids), `players: PlayerId[]`, `cards: number[]`
(hand card numbers), `option` (a chosen number or a string like `'all'`),
`colors: Color[]`. For "may" effects, do nothing when the needed choice is absent.

## Values

Values are 0–12; a two-dice secondary like `[6][1]` is stored as `secondaryValue.value = 7`.
`suppress` forces value 0 but the mood keeps its colour/identity for "counts in
play" queries. Copying: set `mood.copyOf = cardNumber` (engine resolves data/effects
through it). "Becomes yours" = `giveMood(mood, me)`.

## Gaps to flag (don't invent engine APIs)

If a card needs something not above — e.g. "play a mood from the discard pile",
Chaos's gather-shuffle-deal, reveal-from-hand information — implement what you can
via direct `ctx.state` access (arrays are mutable) and **clearly flag it in your
report** so the engine can grow a proper primitive. Never edit files outside your
colour file + its test.
