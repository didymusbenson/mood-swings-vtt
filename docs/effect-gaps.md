# Effect encoding — known gaps & data notes

Status of full-automation encoding. All 130 playable cards are registered and fully
modelled. A rules-fidelity audit (against `RULES.md` + `card-notes.md`) then found and
fixed several timing/lifecycle bugs — see "Rules-fidelity fixes" below. This file is a
record of the engine primitives added to reach fidelity (see "Recently closed").

## Rules-fidelity fixes (from the audit against RULES.md + card-notes.md)

An independent audit grounded only in the authoritative docs found the value/data layer
faithful but several **timing/lifecycle** bugs. All fixed (tests in `test/fidelity.test.ts`):

1. **Sustained suppression now clears** when the suppressor leaves play or changes owner
   (Faith #12, Guilt #14, Meekness #19, Pacifism #20, Shame #25). `suppress(..,'sustained')`
   records the suppressing mood's uid (`suppressedBy`); `clearSuppressionsBy(uid)` lifts it
   from discard/bottom-deck/return/steal/give. Previously sustained suppression was permanent.
2. **Sneakiness #51** swaps scores only the round it was played (added a `playedRound` gate);
   it was re-swapping every round it stayed in play.
3. **Hostility #94 / Worry #52** re-settle "While in play" values between their two sub-effects
   via the new `ctx.restabilize()`, then read `currentValue` (RULES.md's worked example). They
   previously used a frozen snapshot, inverting the documented result.
4. **Bashfulness #30** self-bottom-decks only on the round it was played (`playedRound` gate);
   it was triggering on any later round it won.
5. **Instability #96** now transfers the explicitly-chosen opponent mood (the opponent's pick at
   the shared hotseat screen) instead of auto-picking the lower-value one.
6. **Betrayal #56** reclaim is gated to the round played (was ungated across rounds).
7. **Pride #22** allowance tracks the chosen player's LIVE mood count (constraint stores the
   player, not a frozen target), so shrinking their board mid-turn lowers your remaining plays.

Note (#8, no code change): Meekness's card rules line says "all moods" (which the engine
follows) while one notes bullet says "your moods" — an internal contradiction in the notes;
the primary rules line governs.

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
- **`colorSharedWithControllerMoods` constraint** — #114 Eagerness, #121 Grace's
  discard grant. New `PlayConstraint` kind; `ConditionalGrant` gained an optional
  `from: 'hand' | 'discard'` so a constrained grant can target either zone.
  `grantConditionalMood(constraint, from?)` and `extraPlaysAtTurnStart().grants` push
  them; `consumePlay` spends `from:'hand'` grants, `consumeDiscardPlay` spends
  `from:'discard'` grants. `grantAllows` checks "shares a colour with one of your
  moods" using `colorOf` (honours Imagination #42). Grace's own-turn grant comes from
  `afterPlaying`, its recurring grant from `extraPlaysAtTurnStart`. Grace/Eagerness are
  green, so a green extra always qualifies; off-colour plays are rejected.
- **"Score … an extra time"** — #108 Bliss, #116 Enthusiasm, #89 Exhilaration,
  #97 Passion. New `CardEffects.scoreExtras(ctx) => { player, points }[]`, applied
  during `Engine.score` after values stabilise and **before** the score is logged, so
  the logged scores and the round winner both reflect it. Bliss/Enthusiasm/Exhilaration
  add to their owner; Passion adds a chosen opponent's mood value to its owner while the
  opponent still scores it (its base score is untouched).
- **Skip / cancel a round's scoring** — #107 Awe. New `CardEffects.cancelsRoundScoring`
  (gated to the round Awe was played, since the mood persists) makes `Engine.score`
  take a no-score path: no winner, no losers drawing, no after-scoring effects; the
  round still ends. `chooseNextFirstPlayer` supplies the next leader. Round transition
  is unified in `Engine.startNextRound` (shared by normal `endRound` and Awe's skip).
- **Extra round win** — #60 Corruption. New `CardEffects.extraRoundWinsForWinner`,
  summed over in-play moods and added to the **actual** round winner's `roundsWon` in
  `endRound` (honours the real tie-break, unlike the old projected-winner scan).
- **Play-gate (colour restriction next round)** — #36 Doubt. `GameState.bannedColors` /
  `pendingBannedColors`: Doubt stages the revealed cards' colours; `startNextRound`
  rotates them into effect for exactly the next round; `playMood` rejects any play of a
  banned-colour card (the app surfaces the rejection as a toast).
- **Leave-play hook** — #82 Arrogance. New `CardEffects.onLeavePlay`, fired by the
  true-leave mutations (discard / bottom-deck / return-to-hand — not steal/give) just
  before the mood is removed. Arrogance gives the taken mood back to its original owner
  (if still controlled).
- **Round-scoped discard counter** — #132 Vulnerability. `GameState.discardedThisRound`
  counts discards from any zone this round (reset each round), so a pile carried over
  from prior rounds no longer wrongly triggers it.
- **Creativity copy + independent copied-card targets** — #32 Creativity. The copy
  target now lives in its OWN field, `choices.copy` (a card number), chosen in the UI
  via a dedicated `copy` slot (`TargetKind: 'copy'`); the copied card's own targets flow
  through `choices.moods`/`players`/`cards`/… with no positional collision, so a copied
  card that itself targets moods (e.g. Conviction #6) resolves correctly. Creativity
  delegates canPlay/payCost/afterPlaying to the copied card; every while-in-play /
  scoring hook resolves through `copyOf` automatically. The app walks the copied card's
  spec as a second stage after the copy is chosen (drag or manual). Verified end-to-end
  in the browser (copy a [4] mood → the Creativity mood scores [4]) and by unit tests.

## Missing engine primitives

None. All 130 playable cards are faithfully modelled with no approximations. (#135
Hurt Feelings remains the 3+-player, non-scoring helper — see below.)

Hand-to-hand card passing (#31 Confusion, #49 Rationalization, #85 Chaos,
#86 Compulsion, #106 Zeal) is done via direct `ctx.state` mutation (sanctioned by
the authoring guide) and works.

## Out of scope

- #135 Hurt Feelings — 3+ player helper, non-scoring; not used in the 2-player MVP.
