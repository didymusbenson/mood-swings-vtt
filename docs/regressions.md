# Regression Log — Card Targeting Flow

> A running record of gameplay bugs found during card debugging and how each was
> fixed. Each entry names the affected cards, the root cause, the fix (with the
> files touched), and the tests that lock the behaviour in. Newest first.
>
> **Source** categorises how each bug was found:
> - 🧑 **User-reported** — called out by the user during play/bug-bashing.
> - 🔎 **Audit-reported** — surfaced proactively by cross-checking specs against
>   effects, not (yet) hit in play.

| ID | Card(s) | Source | Status |
| --- | --- | --- | --- |
| R-003 | Fury #91 | 🔎 Audit-reported | ✅ Fixed |
| R-002 | Panic #48 + 5 siblings | 🧑 User-reported | ✅ Fixed |
| R-001 | Corruption #60 + 3 siblings | 🧑 User-reported | ✅ Fixed |

The targeting flow is the guided "pick your targets" panel that opens when a card
needs choices before it resolves. It is driven entirely by declarative per-card
**specs** (`packages/engine/src/cards/specs/*.ts`) via
`legalTargets` / `slotApplies` in
[`packages/engine/src/cards/choice-spec.ts`](../packages/engine/src/cards/choice-spec.ts),
and walked slot-by-slot by the React hook
[`packages/app/src/hooks/usePlayInteraction.ts`](../packages/app/src/hooks/usePlayInteraction.ts).
The engine card effects (`packages/engine/src/cards/*.ts`) remain the source of
truth for legality; a spec bug means the UI offered a choice the effect would
never honour (or skipped one it needs).

---

## R-003 — Fury #91 offered non-highest moods

**Source:** 🔎 Audit-reported — surfaced proactively while auditing every remaining
`from: 'any'` mood slot for the same over-offer class as R-002, by cross-checking
each spec against its effect. Not hit in play.

**Affected card:** #91 Fury — "each player discards one of their highest-value moods."

**Root cause:** the mood slot used `mood: { from: 'any' }`, offering *every* mood in
play. But the effect
([`packages/engine/src/cards/red.ts`](../packages/engine/src/cards/red.ts), `registerEffects(91)`)
computes each player's max value and only accepts a pick among the tied-top moods
(`top.find(chosen) ?? top[0]`). Selecting a non-highest mood was silently ignored
and the effect fell back to an arbitrary top mood — the same "UI offers targets the
effect rejects" pattern as the parity cards fixed in feedback F9. It only bites when
a player holds two or more moods tied at their maximum (otherwise the single top mood
is forced anyway), which is why it went unreported.

**Fix:** added a `highestPerOwner` flag to `MoodFilter`
([`choice-spec.ts`](../packages/engine/src/cards/choice-spec.ts)); `legalTargets`
now keeps only each owner's top-current-value mood(s) within the slot's scope (ties
all offered, so the player still chooses *which* top mood). Tagged Fury #91's slot in
[`specs/red.ts`](../packages/engine/src/cards/specs/red.ts) with
`{ from: 'any', highestPerOwner: true }`.

**Tests:** [`packages/engine/test/specs.test.ts`](../packages/engine/test/specs.test.ts)
— `describe('highestPerOwner offers only each owner top-value mood(s) (Fury #91)')`:
a board where p1 has two moods tied at [6] plus a [1], and p2 has [4] over [3];
asserts both of p1's top moods and p2's [4] are offered, and neither lower mood is.

---

## R-002 — "Choose their moods" cards offered every seat's moods

**Source:** 🧑 User-reported — playing **Panic #48** as Player 1, choosing only
Player 2, the mood picker still listed Player 1's moods. Only the chosen player's
moods should be selectable.

**Affected cards (all shared the same shape):**

| Card | Effect wording |
| --- | --- |
| #7 Courage | up to two players each lose a [5]+ mood |
| #28 Anxiety | up to two players each return an odd-value mood |
| #48 Panic | up to two players each return a mood to hand |
| #68 Malice | a chosen player picks two of *their* moods |
| #76 Spite | up to two players each discard an even-value mood |
| #101 Shock | up to two players each discard a [3]-or-less mood |

**Root cause:** each spec's second (mood) slot used `mood: { from: 'any' }`, which
`legalTargets` enumerates as *every mood in play*. But each effect only ever
touches `ctx.moodsOf(pid)` for the players chosen in the first slot (Malice #68
even asserts `m.owner === pid`). So the picker offered moods no chosen player
owned; selecting one silently fell through to the effect's `?? targets[0]`
default. The mood slots had no equivalent of the `cardsFrom: 'chosen'` mechanism
that already scoped *hand-card* slots to an earlier player choice.

**Fix:** added a `'chosen'` value to `MoodFilter.from`
([`choice-spec.ts`](../packages/engine/src/cards/choice-spec.ts)) that scopes the
mood pool to the players picked in an earlier `players` slot (via
`SlotContext.players`, which `usePlayInteraction` already threads into
`legalTargets`). It offers nothing until a player is chosen, exactly mirroring
`cardsFrom: 'chosen'`. Retagged all six specs from `from: 'any'` to
`from: 'chosen'`:

- [`specs/white.ts`](../packages/engine/src/cards/specs/white.ts) — #7 Courage
- [`specs/blue.ts`](../packages/engine/src/cards/specs/blue.ts) — #28 Anxiety, #48 Panic
- [`specs/black.ts`](../packages/engine/src/cards/specs/black.ts) — #68 Malice, #76 Spite
- [`specs/red.ts`](../packages/engine/src/cards/specs/red.ts) — #101 Shock

The `selfTargetable` self-pick logic in `usePlayInteraction.ts` is unaffected: it
already prepends the `SELF_TARGET` sentinel only when the acting player is among
the chosen, and `playedMoodQualifies` only special-cases `from: 'opponent'`.

**Tests:** [`packages/engine/test/specs.test.ts`](../packages/engine/test/specs.test.ts)
— new `describe("from:chosen mood slots enumerate only the chosen players' moods")`
block: Panic #48 offers only the chosen seat (not the acting player, not an
unchosen third seat), the scope spans a union of chosen players while still
honouring value filters, it yields nothing before a player is picked, and a
parameterised check asserts `from: 'chosen'` on all six cards. Pre-existing
parity/maxValue tests (#28/#76/#101) were updated to pass `{ players: [...] }`
now that the scope depends on it.

---

## R-001 — Wrong option-branch still prompted for targets

**Source:** 🧑 User-reported — playing **Corruption #60** and choosing the "double
the win" branch still popped a "Choose up to two cards" prompt (from an empty
discard pile), showing "No valid cards". The panel header also read "cards from
your hand" when the source is the discard pile.

**Affected cards:**

| Card | Follow-up slot that should be gated |
| --- | --- |
| #14 Guilt | pick a black/red mood — only on the "one" branch |
| #41 Hesitation | pick a red/green mood — only on the "one" branch |
| #59 Contempt | pick a green/white mood — only on the "one" branch |
| #60 Corruption | pick discard cards — only on the "cards" branch |

**Root cause:** the flow walked slots strictly in order (`slotIndex + 1`) with no
way to skip a slot based on an earlier `option` choice. The "only applies on
branch X" intent lived solely in the label text (`"(if 'cards')"`,
`"(if 'one')"`) with nothing enforcing it. The engine already ignored the unused
choices on the off branch, so the effect was correct — only the UI over-prompted.

**Fix:** added a declarative `showWhen: { option: string[] }` gate to `ChoiceSlot`
plus a `slotApplies(slot, option)` helper in
[`choice-spec.ts`](../packages/engine/src/cards/choice-spec.ts). `finishOrAdvance`
in [`usePlayInteraction.ts`](../packages/app/src/hooks/usePlayInteraction.ts) now
skips gated-out slots as it advances (finishing the play if only gated slots
remain). Tagged the four specs: #60 → `{ option: ['cards'] }`; #14/#41/#59 →
`{ option: ['one'] }`. Slots with no `showWhen` always apply, so cards whose
follow-up applies to *both* branches (Avoidance #29, Confusion #31) are untouched.

Separately, the modal heading in
[`GameBoard.tsx`](../packages/app/src/components/GameBoard.tsx) (`slotNoun`)
hardcoded "from your hand" for every hand-card slot; it is now source-aware —
discard slots read "from the discard pile", chosen-hand slots "from their hand".

**Tests:** [`packages/engine/test/specs.test.ts`](../packages/engine/test/specs.test.ts)
— `describe('showWhen gates a follow-up slot on the chosen option')`: Corruption
#60's recovery slot applies only on `'cards'` (not `'wins'`/`null`), #14/#41/#59
mood slots only on `'one'`, and ungated slots (#29/#31) apply to both `'left'` and
`'right'`.
