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

## Recently closed (now fully modelled)

- **Colour override** — #42 Imagination. `Mood.colorOverride` is a serialisable
  per-mood cache recomputed each stabilisation by `Engine.applyColorOverrides`
  (driven by the `CardEffects.colorOverride(ctx)` hook). It is continuous: moods
  played after Imagination are recoloured too, a later Imagination overrides an
  earlier one, and everything reverts when the source leaves play. `queries.colorOf`
  / `ReadContext.colorOf(mood)` honour it, so `countColor`, `mostCommonColors`, and
  every "shares a colour / colour in play" check on a **mood in play** now see the
  override. Cards in hand/deck/discard keep their printed colour (read via
  `card(m).color` / `cardData(n).color`) — audited and left as-is.
- **Play a mood from the discard pile** — #69 Melancholy, #54 Angst, #65 Grief,
  #123 Harmony, #121 Grace. The `play` Action gained `from?: 'hand' | 'discard'`;
  a discard play removes the card from `state.discard` and must be permitted by a
  discard-play grant. `MutationApi.grantDiscardMood(n)` fills the serialisable
  `GameState.discardPlaysRemaining` counter (Angst +1, Grief +2, Harmony/Grace +1);
  Melancholy instead exposes `CardEffects.permitsPlayFromDiscard`, a continuous
  permission that lets a `from:'discard'` play consume a normal play. A hand card
  can't be played as a discard play and vice-versa.
- **Creativity copy + cost** — #32 Creativity, see the disambiguation note below.
- **Start-of-turn / recurring extra play** — #124 Hope, #121 Grace (recurring half),
  #102 Stubbornness. `CardEffects.extraPlaysAtTurnStart(ctx) => { normal?, fromDiscard? }`
  is re-evaluated for each of the active player's in-play moods at every turn start
  (the `Engine.resetTurn` path shared by `setup`, `advance`, and `endRound`), so these
  grants fire on every one of the owner's turns while the mood is in play and stop once
  it leaves. Hope → `{normal:1}`, Grace → `{fromDiscard:1}`, Stubbornness → `{normal:1}`
  only when an opponent has strictly more moods. The turn a Hope/Grace is *played* is
  covered by its `afterPlaying` grant ("including the turn you play this mood").
- **Cross-turn / other-player extra play** — #125 Joy (self), #120 Generosity (chosen
  opponent). Serializable per-player counters `GameState.pendingExtraPlays` /
  `pendingDiscardPlays` hold one-time future grants; `MutationApi.grantExtraPlayNextTurn`
  / `grantDiscardPlayNextTurn` fill them, and `resetTurn` folds a player's pending count
  into `playsRemaining` / `discardPlaysRemaining` at their turn start and clears it
  (consumed exactly once).

## Missing engine primitives (best-effort today; flagged by encoders)

These effects are implemented as far as the current API allows (often logged or
approximated) without crashing; adding the primitive would make them fully faithful.

- **Skip / cancel a round's scoring** — #107 Awe. No hook to cancel scoring / the
  round win / losers drawing.
- **Extra round win** — #60 Corruption (and its Awe interaction). Approximated by
  pre-incrementing the projected winner in `afterScoring`.
- **"Score a mood an extra time"** — #108 Bliss, #116 Enthusiasm, #89 Exhilaration,
  #97 Passion. Approximated by adjusting `roundScores` in `afterScoring` (winner is
  still decided correctly).
- **`colorSharedWithControllerMoods` constraint** — #114 Eagerness (only the inverse
  exists today; grants an unconstrained extra play). Also #121 Grace's discard-play
  colour-match ("if it shares a colour with one of your moods") is unconstrained:
  `discardPlaysRemaining` is a shared plain counter that can't distinguish a
  Grace-sourced grant from Harmony's unconstrained one, so the colour-match is not
  enforced. This is the sole residual of the (now-closed) recurring/cross-turn
  extra-play work — the recurring discard grant itself fires correctly each turn.
- **Play-gate (colour/other restrictions next round)** — #36 Doubt (recorded/logged
  only).
- **Creativity dual mood-target disambiguation** — #32 Creativity now copies a mood
  in play (`choices.moods[0]`), adopts value/colour/abilities via `copyOf` set before
  cost resolution, and DOES pay the copied card's "To play" cost (its canPlay/payCost
  are delegated; `choices.moods[1..]` feed the copied card's own mood targets).
  Residual: a copied card that needs two independent *mood-target lists* can't be
  disambiguated from the single shared `moods` array (rare in the set).
- **Leave-play hook** — #82 Arrogance's "give back when this leaves play".
- **Round-scoped discard counter** — #132 Vulnerability (approximated as "discard
  non-empty").

Hand-to-hand card passing (#31 Confusion, #49 Rationalization, #85 Chaos,
#86 Compulsion, #106 Zeal) is done via direct `ctx.state` mutation (sanctioned by
the authoring guide) and works.

## Out of scope

- #135 Hurt Feelings — 3+ player helper, non-scoring; not used in the 2-player MVP.
