# Feature: In-App Rules Reference

> **Status:** Implemented.

## Summary

Players need to reference the rules without leaving the game, and new players
need a comprehensive on-ramp before starting. Provide two surfaces: a
comprehensive **How to Play** from the main menu, and a quick **(?)** simplified
reference in the in-game toolbar.

## Implementation

Both surfaces are built and wired; the simplified rules are factored into a
shared component so the modal is a single source of truth.

**(A) Main-menu "How to Play" — full-screen view**
- Reached from the main menu: the **How to Play** button in the start-screen
  header (`packages/app/src/components/StartScreen.tsx`, `showRules` state swaps
  the start content for the full view).
- View: `packages/app/src/components/HowToPlay.tsx` — a `position:fixed`
  full-screen shell (not a modal) with an internally-scrolling body and a
  "← Back to menu" button in both the header and footer. Text reconstructed from
  [`docs/RULES.md`](../RULES.md) (anatomy, deck, setup, round structure, taking a
  turn incl. the three effect types / order of operations / the
  Worry·Hostility·Superiority worked example, scoring, after-scoring incl.
  Recklessness·Bashfulness·Sneakiness, and the vocabulary glossary). Links out to
  MaRo's post twice (intro + footer).
- Figures: `packages/app/src/components/rules/figures.tsx` — `ExampleFigure`
  renders each named card with the app's **own** `<Card>` renderer (from
  `data/cards.json`, never lifted WotC art), and `AnatomyFigure` shows a rendered
  card beside a numbered 1–12 callout legend. All 11 named example cards are
  present (Creativity, Self-Loathing, Patience, Disgust, Rage, Superiority,
  Worry, Hostility, Bashfulness, Recklessness, Sneakiness).

**(B) In-game "(?)" — simplified-only modal**
- Reached from the in-game top toolbar: the round `?` icon button in
  `.topbar__actions` (left of "New game") in
  `packages/app/src/components/GameBoard.tsx` (`rulesOpen` state).
- Modal: `packages/app/src/components/RulesModal.tsx` — reuses the
  `DiscardInspector` overlay pattern (`role="dialog" aria-modal`, dismiss via
  Esc / scrim / Close) and never touches game state. **Simplified-only**: no
  link to the full view or any external site.
- Content: `packages/app/src/components/rules/simplified.tsx`
  (`SIMPLIFIED_RULES` + `SimplifiedRulesBody`), transcribed from the simplified
  rules below.

**Styles:** a "Rules reference" block appended to
`packages/app/src/styles.css` (`.btn--icon`, `.howto*`, `.rules-fig*`,
`.rules-anatomy*`, `.rules-simple*`), reusing the existing overlay / inspector /
panel / btn classes.

**Verification:** `npm run typecheck`, `npm run build`, and
`npm run test --workspace @mood-swings/app` (28 tests) all pass. Both components
were additionally server-rendered in a throwaway test to confirm they mount and
that the modal contains no anchors / external links / full-view jump-off.

> **Minor note:** the modal omits the transcribed closing line _"For additional
> rules information, please visit: SecretLair.Wizards.com/MoodSwings"_ — dropped
> deliberately to honor the simplified-only "no jump-off" rule (a printed URL
> could invite navigation mid-game). All five rule sections are otherwise verbatim.

## Spec

### 1. Main menu — "How to Play" (out of game)

- A **How to Play** entry on the **main menu** (pre-game / out-of-game) that
  opens a **dedicated rules view** (a full screen, not a modal).
- Content: copy the relevant comprehensive-rules information into this view. It's
  acceptable for it to be either a **direct rip of the original extended-rules
  PDF**, or a **reconstruction of it with example cards**.
- **Links back to MaRo's post** on the Wizards site:
  <https://magic.wizards.com/en/news/feature/mood-swings-extended-rules>

> **Source note:** The original PDF was re-supplied and reviewed in full (15
> pages). Its mechanical content is **already fully captured** in
> [`docs/RULES.md`](../RULES.md) — anatomy of a card, deck/setup, round
> structure, the effect-resolution pipeline (incl. the Worry/Hostility and Rage
> worked examples), scoring/after-scoring/Sneakiness, and the complete vocabulary
> glossary. So the view's **text** can be built from `docs/RULES.md` without
> needing the PDF again. The PDF is **not committed** (WotC IP + 1.4 MB), same
> policy as the card art.
>
> **Recommended build:** a **reconstruction** — lay out the rules text from
> `docs/RULES.md`, and render the example-card figures with the app's **own card
> renderer** (from `data/cards.json`) rather than lifting the PDF's WotC art, to
> stay consistent with the "don't commit card art" policy. (A literal PDF rip
> would re-introduce that art.)

### Example cards used by the extended rules (for figures)

The extended rules illustrate points with these specific cards — reconstruct
them with our renderer where the view references them:
**Creativity**, **Self-Loathing**, **Patience**, **Disgust**, **Rage**,
**Superiority**, **Worry**, **Hostility**, **Bashfulness**, **Recklessness**,
**Sneakiness** — plus the **"anatomy of a card"** labeled diagram (callouts
1–12: name, frame, reminder icon, value, art, rules text, secondary value, first
edition symbol, collector number, color, artist, rarity).

### 2. In-game toolbar — "(?)" simplified reference

- A **(?)** control in the in-game **toolbar**, alongside where **Settings**
  will live (see [`settings.md`](settings.md)).
- Opens a **how-to-play reference modal** containing the **simplified rules**
  (the printed rules card + card-back scoring text). Transcribed content below.
- **Simplified-only — no jump-off.** The modal does **not** link out to the full
  rules view or the external site. Rationale: avoid any popup/redirect that could
  risk disrupting in-progress game state, and the engine enforces the rules
  anyway, so players only need the basics mid-game.

## Simplified rules content (for the modal)

> Transcribed verbatim from the physical rules card + card back. Wording is the
> game's own; not invented.

**Mood Swings Rules (2–4 Players)**

**Setup** — All players share the same deck and discard pile. Shuffle the deck,
then each player draws five cards. Reveal the bottom card of the deck. The player
who most recently felt that emotion goes first in round 1.

**Round Structure** — Each round, the first player takes their turn, then each
other player takes a turn in clockwise order. After everyone has taken a turn,
proceed to scoring.

**Taking a Turn** — On your turn, you may play one card or pass the turn. To play
a card, put it into play face up. It becomes one of your moods. Most cards have
special effects which can break the rules of the game, so read them carefully!
Your moods stay in play unless an effect puts them elsewhere.

**Scoring** — Each card has a value, shown by the die in its top-right corner.
That value can change due to card effects. Each player scores by adding up the
values of each of their moods. The player with the highest total value wins the
round. If there's a tie, whoever took a turn earliest this round wins the tie.

**After Scoring** — If a player has won three rounds, they win the game!
Otherwise: each player who lost the round draws a card. In a 3+ player game, the
player with the lowest score this round gets "Hurt Feelings" which allows them to
play an additional mood during their next turn. Start a new round with the player
who won this round going first.

_For additional rules information, please visit: SecretLair.Wizards.com/MoodSwings_

## Related sources

- [`docs/RULES.md`](../RULES.md) — full extended ruleset (comprehensive; main-menu
  How to Play).
- [`docs/card-notes.md`](../card-notes.md) — Mark Rosewater's per-card mechanical
  clarifications.

## Open questions / to refine

- Confirm the **reconstruction** approach (own-rendered example cards, text from
  `docs/RULES.md`) vs. a literal PDF rip — see Recommended build above.

**Resolved:**
- Main-menu How to Play is a **dedicated full-screen view** (not a modal).
- Source content confirmed available and fully captured in `docs/RULES.md`; PDF
  not committed (IP).
- In-game **(?)** modal is **simplified-only** — no jump-off to the full rules
  view or external site (avoid disrupting game state; engine enforces the rules).
