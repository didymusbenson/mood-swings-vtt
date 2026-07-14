# Value Transparency — Card Value Audit

Consolidated output of the per-card research spike backing the **Value
Transparency** feature (`docs/features/value-transparency.md`). It records, for all
134 collector-numbered cards, whether the engine's computed value matches the
printed card, and which cards self-highlight a value clause.

- **Highlight metadata module:** `packages/engine/src/cards/highlights.ts`
  (registered via `cards/index.ts`; exported from the engine as
  `highlightFor` / `registerHighlight` / `HighlightMeta`).
- **Scope:** self-modification only (a card's OWN text driving its value). The
  external "Modified by {cardname}" case (suppression, another mood's
  `whileInPlay` modifier) is derived at runtime and needs no per-card metadata.

## (a) Flagged discrepancies (ENGINE bugs to REVIEW — not fixed by this feature)

No **value-wiring** discrepancies were found: every card's computed value matches
its printed primary/secondary across all 134 entries (`wiredCorrectly: true`,
`discrepancy: null`). The engine value logic is sound for the transparency feature
to read from.

The research did surface **stale source comments** — the code is correct, the
adjacent comment is not. These are cosmetic and cannot mislead the runtime, but are
listed so a maintainer can correct them:

| Card | Name | Printed vs. engine | File:line | Severity |
|------|------|--------------------|-----------|----------|
| #19 | Meekness | Printed "value [5] or more"; code correctly uses `valueOf >= 5`. Comment near the effect says "worth [2]+", which is wrong. | `packages/engine/src/cards/white.ts:~174` | Low (comment only) |
| #94 | Hostility | Printed "value [3] or less"; code correctly uses `currentValue <= 3`. Inline comments say `[2]`. | `packages/engine/src/cards/red.ts:~186-188` | Low (comment only) |
| #98 | Rage | Printed "value of [3] or less"; code correctly uses `valueOf <= 3`. Inline comment says `[2]`. | `packages/engine/src/cards/red.ts:~255` | Low (comment only) |

No action required for Value Transparency; flag to engine maintainers separately.

## (b) valueKind breakdown

| valueKind | Count | Meaning |
|-----------|-------|---------|
| `fixed` | 86 | Own value never changes (printed die); rules text acts on other moods/board. |
| `dynamic-self` | 42 | Own value is driven by the card's own text → **self-highlight**. |
| `vanilla` | 5 | No rules text at all (#5, #44, #55, #83, #126). |
| `copy` | 1 | Creativity (#32); value inherited from the copied card. |
| **Total** | **134** | |

- **Highlight entries written: 42** — one per `dynamic-self` card (the set with
  `highlight.hasHighlight === true`). `fixed`, `vanilla`, and `copy` cards get no
  entry (`highlightFor` returns `undefined`).

## (c) Highlight granularity decision

**Granularity: EXACT-CLAUSE.** Each entry marks a **verbatim substring** of the
card's printed `rulesText` (from `data/cards.json`), not the whole rules text.
All 42 clauses were verified to `indexOf`-match their printed text exactly
(brackets and punctuation included), so the app can locate the span with a plain
string search.

Two clause shapes are used, mirroring the two `intrinsicValue` families:

- **Board-query cards** (`while in play — this mood's value is […] if <board>`):
  the marked clause is the full "This mood's value is …" sentence; the `condition`
  re-runs the same `countColor` / mood-count / hand / discard predicate the card's
  `intrinsicValue` uses (e.g. #81 `ctx => ctx.opponentsOf(ctx.self.owner).some(p =>
  (ctx.state.hands[p]?.length ?? 0) >= 3)`).
- **Boost-flag cards** (`If you do, this mood's value becomes […]`, set at play
  time — #1, 8, 33, 58, 62, 87, 95, 110, 111, 118): the marked clause is the
  "…this mood's value becomes […]" fragment and the `condition` is
  `ctx => !!ctx.self.data.boost`.

### Cards where an exact clause needed a judgement call

Every card yielded a clean verbatim substring, but three groups required a choice
about *which* span to mark:

- **Boost-flag "becomes" cards** — the printed text is a two-part conditional
  ("You may discard … If you do, this mood's value becomes [5]."). Only the
  **value-outcome fragment** is marked (`this mood's value becomes [5]`), since the
  condition ("You may discard …") is a play-time choice, not a live board state.
  The one exception is **#62 Cynicism**, whose printed text places the outcome in a
  standalone sentence, so the marked clause is `If you do, this mood's value becomes
  [6].` (still verbatim).
- **"Increase by" cards** (#64, 74, 79, 117, 130, 133) — these have no
  primary/secondary branch; the clause is *always* the value driver while in play.
  Their `condition` returns true when the increment is actually non-zero (e.g. #74
  when the discard pile is non-empty; #133 only after its colour is chosen and that
  colour is present), so the highlight signals "this clause is currently affecting
  the number", consistent with the Animosity worked example.
- **Trailing parentheticals** — several cards append "(Moods are cards in play.)"
  or "(including this one)". The marked clause stops at the sentence that carries
  the value rule and omits pure-glossary parentheticals where they are a separate
  sentence (#77, #112, #119); where "(including this one)" is grammatically part of
  the value sentence it is kept (#127, #129, #131, #134).

### Duplicate name note (informational, not a discrepancy)

Both **#127** and **#134** are named "Love" with identical text/logic (#134 is the
headliner foil). Both are registered independently and both self-highlight; no
action needed.
