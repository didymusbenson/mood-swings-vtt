# Feature: In-App Rules Reference

> **Status:** Refined (first pass).

## Summary

Players need to reference the rules without leaving the game, and new players
need a comprehensive on-ramp before starting. Provide two surfaces: a
comprehensive **How to Play** from the main menu, and a quick **(?)** simplified
reference in the in-game toolbar.

## Spec

### 1. Main menu — "How to Play" (out of game)

- A **How to Play** entry on the **main menu** (pre-game / out-of-game).
- Presents the **comprehensive rules** — the project's extended-rules copy in
  [`docs/RULES.md`](../RULES.md) (a faithful extraction of Mark Rosewater's
  *Mood Swings Extended Rules*).
- **Links back to MaRo's post** on the Wizards site:
  <https://magic.wizards.com/en/news/feature/mood-swings-extended-rules>

### 2. In-game toolbar — "(?)" simplified reference

- A **(?)** control in the in-game **toolbar**, alongside where **Settings**
  will live (see [`settings.md`](settings.md)).
- Opens a **how-to-play reference modal** containing the **simplified rules**
  (the printed rules card + card-back scoring text). Transcribed content below.

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

- The main-menu comprehensive view: render `docs/RULES.md` **as-is**, or author a
  cleaned player-facing version? (The current doc is a build-oriented extraction
  with some engine/authoring notes mixed in.)
- Main-menu How to Play: a dedicated screen, or a modal like the in-game one?
- Should the in-game **(?)** modal also offer a "full rules" jump-off (to the
  comprehensive view and/or the external link), or stay simplified-only?
