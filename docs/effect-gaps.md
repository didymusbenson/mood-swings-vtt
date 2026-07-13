# Effect encoding — known gaps & data notes

Status of full-automation encoding. All 130 cards are registered and the suite is
green; this tracks the approximations and the primitives worth adding for 100%
fidelity.

## Data correction — inline rules-text values (RESOLVED via card-notes)

The scraper (`tools/scrape-cards.mjs`) read each card's **printed value** correctly
but under-read some **inline dice inside rules text** (it took them from Scryfall's
meta description, which disagrees with Wizards' own card text). The authoritative
source is `docs/card-notes.md` (verbatim Wizards text), corroborated by the
extended-rules PDF (e.g. "Anger … total value **[5]**", "Rage … **[3]** or less").

Corrected cards (rules-text value fixed in `data/cards.json` **and** in the encoded
constants): Courage (#7 ≥[5]), Friendliness (#13 {0,2,4,6}), Kindness (#17 {1,3,5}),
Meekness (#19 ≥[5]), Envy (#64 +[2]), Sadness (#74 +[2]), Vanity (#79 +[1]/[3]),
Anger (#80 ≤[5]), Embarrassment (#87 {4,5,6}→[5]), Hostility (#94 ≤[3]),
Rage (#98 ≤[3]), Shock (#101 ≤[3]), Cheer (#110 {0,2,4,6}), Delight (#111 {1,3,5}),
Wonder (#133 +[2]). Printed `value`/`secondaryValue` were already correct.

## Missing engine primitives (best-effort today; flagged by encoders)

These effects are implemented as far as the current API allows (often logged or
approximated) without crashing; adding the primitive would make them fully faithful.

- **Play a mood from the discard pile** — #69 Melancholy, #54 Angst, #65 Grief,
  #121 Grace, #123 Harmony. `grantAdditionalMood` only enables hand plays; the
  card count is right but the source (discard) isn't honoured.
- **Colour override** — #42 Imagination recolours all moods, but colour is derived
  from card data, so colour-based queries don't see the override. (Highest-impact
  gap — Imagination interacts widely.) Needs a per-mood `colorOverride`.
- **Skip / cancel a round's scoring** — #107 Awe. No hook to cancel scoring / the
  round win / losers drawing.
- **Extra round win** — #60 Corruption (and its Awe interaction). Approximated by
  pre-incrementing the projected winner in `afterScoring`.
- **"Score a mood an extra time"** — #108 Bliss, #116 Enthusiasm, #89 Exhilaration,
  #97 Passion. Approximated by adjusting `roundScores` in `afterScoring` (winner is
  still decided correctly).
- **Start-of-turn / recurring extra play** — #102 Stubbornness, #121 Grace,
  #124 Hope. No turn-start hook.
- **Cross-turn / other-player extra play** — #120 Generosity, #125 Joy. `playsRemaining`
  is current-player/current-turn only.
- **`colorSharedWithControllerMoods` constraint** — #114 Eagerness (only the inverse
  exists today; grants an unconstrained extra play).
- **Play-gate (colour/other restrictions next round)** — #36 Doubt (recorded/logged
  only).
- **Copy-before-cost ordering** — #32 Creativity copies value/colour/abilities via
  `copyOf` and fires the copied `afterPlaying`, but does not pay the copied card's
  "To play" cost.
- **Leave-play hook** — #82 Arrogance's "give back when this leaves play".
- **Round-scoped discard counter** — #132 Vulnerability (approximated as "discard
  non-empty").

Hand-to-hand card passing (#31 Confusion, #49 Rationalization, #85 Chaos,
#86 Compulsion, #106 Zeal) is done via direct `ctx.state` mutation (sanctioned by
the authoring guide) and works.

## Out of scope

- #135 Hurt Feelings — 3+ player helper, non-scoring; not used in the 2-player MVP.
