# Feature: Pre-Game Configuration & Alternate Formats

> **Status:** Stub — brief captured, not yet refined.
>
> **Source:** Mark Rosewater, "Other Ways to Play Mood Swings." The rules below
> are transcribed/reorganized from that article, not invented.

## Summary

Add pre-game configuration that lets players select an alternate play format
instead of only traditional play. The core gameplay loop stays the same (play a
card each turn, have the highest score, win three rounds), but deck sourcing,
seating, hand-sharing, scoring grouping, and win conditions vary by format.

Formats fall into three categories: **Duel**, **Draft**, and **Team**.

---

## Shared category mechanics

### Duel play (baseline for Duel and Draft formats)

Each player brings their own deck. Key differences from traditional play:

- **Separate decks.** Two decks exist; you always draw from *your own* deck.
  Cards put on the bottom of the deck go to the bottom of *their owner's* deck.
- **Separate discard piles, treated as one.** Each player has their own discard
  pile for ownership tracking, but the game treats both piles as a single large
  discard for any card that counts the discard (e.g. Misery, Sadness) or plays
  from it (e.g. Harmony, Melancholy) — such a card may be played from *either*
  pile.
- **Ownership marking when cards change sides/hands.** Cards can still move to an
  opponent's side or hand; each card's owner must be marked so cards return to
  their owner at game end. (Physical suggestion: two sleeve colors, or a
  counter/coin/die on a card that's on another player's side. Cards going to an
  opponent's hand are marked and placed face-up in front of that player, since
  they're known to both.)
- **Two-player only.** Duel formats are designed for 2 players; tracking hidden
  card movement for >2 isn't possible without leaking information.
- **Running out of cards is possible.** Unlike traditional play, if you can't
  draw, you don't draw. (Hate and Paranoia let a player draw off their own deck
  while a card goes to the bottom of the opponent's deck; you still start with
  more cards than you'll play, so this is rare but possible.)

### Draft play

- Players start with **no cards** and draft from a random mix to build decks.
- Draft formats are **played as duel play** (each player has their own deck).

### Team play

- **Four-player** formats, played in teams of two.
- **Hurt Feelings is not used** in team games.

---

## Formats

### Duel — Structure Duel
- **Players:** 2
- **Deck minimum:** 45 cards
- **Notes:** Out-of-the-box vs. out-of-the-box. Recommended rarity mix: 23
  common, 14 uncommon, 6 rare, 2 mythic rare (the retail box contents). Other
  mixes allowed, but both players should follow the same deck-construction rules.

### Duel — Power Duel
- **Players:** 2
- **Deck minimum:** 15 cards
- **Deck restriction:** only 1 of each card, and 1 mythic rare total.
- **Notes:** Most competitive format; streamlined custom decks. Max 7 cards drawn
  in a game, so games play out differently each time. (This format was updated
  per community feedback.)

### Draft — Quick Draft
- **Players:** 2
- **Total cards drafted:** 48 (16 per… see procedure) — deck minimum **12**.
- **Draft procedure:** Start with a random deck. Each player draws 6 off the top,
  keeps 2, and passes the other 4 to their opponent. From the 4 received, each
  keeps 2 more and discards the remaining 2 face down. Repeat **4 times total**,
  drafting **16** cards each.
  - If drafting from a normal 45-card deck, shuffle **3 random discarded cards**
    from the first three draft picks back in before drawing the last 12, since
    the full draft needs 48 cards.
- **Deckbuild:** May then remove up to 4 cards; deck must be **≥12** (can be
  more).
- **Match:** Play a **best-of-three**; sideboarding allowed between games (must
  have ≥12 before each game). Winner of best-of-three wins the draft.

### Draft — Winston Draft
- **Players:** 2
- **Total cards drafted:** 45
- **Deck minimum:** 12 cards
- **Draft procedure:** Start with a randomized 45-card deck. Make three
  face-down piles of one card each (Pile 1/2/3). The active player looks at Pile
  1 and may take all its cards (then stops); either way, put another card
  face-down on Pile 1 if able. If they didn't take Pile 1, they look at Pile 2
  (same choice + replenish), then Pile 3. If they take no pile, they draw the top
  card of the deck. Only the player looking at a pile (or drawing) sees those
  cards. Turn then passes. Continue until all cards are drafted; once the deck is
  empty, stop replenishing piles but keep going until every card is taken.
- **Deckbuild:** May remove cards, but must keep **≥12** (a deck under 12
  auto-loses every game).
- **Match:** Best-of-three; sideboarding allowed; best-of-three winner wins the
  draft.

### Team — Open Team
- **Players:** 4 (teams of 2)
- **Deck minimum:** 45 cards
- **Seating:** next to your partner
- **Starting hand:** 5 cards
- **Information:** **open** — you and your teammate can see each other's hands.
- **Play order:** Randomize who goes first. A member of the first team takes a
  turn (the team chooses which member). Play passes to the other team (their
  choice of member). Back to the first team — the member who hasn't played goes;
  finally the remaining member of the second team plays.
- **Scoring & win:** Teammates **add scores together**; higher combined score
  wins the round and goes first next round. First team to **3 round wins** wins.
  Losing team draws **1 card**, may look at it, and decides which player gets it.
  **Tie:** the team that played first wins the tie.

### Team — Closed Team
- **Players:** 4 (teams of 2)
- **Deck minimum:** 45 cards
- **Seating:** across from your partner (teams alternate around the table)
- **Starting hand:** 5 cards
- **Information:** **closed** — you can't see your teammate's hand or share info
  about it.
- **Pre-round pass:** After drawing 5, each player **passes 2 cards face down**
  to their teammate. You must pass before looking at what your teammate passed.
  This is the only hand information you can share.
- **Play order:** Randomize who goes first; the winning team each round chooses
  which of its players goes first. Play proceeds **clockwise**, alternating
  between teams.
- **Scoring & win:** Teammates **add scores together**; higher combined score
  wins the round. First team to **3 round wins** wins. Losing team draws **1
  card** and chooses who gets it, **without looking** first. **Tie:** the team
  that played first wins the tie.

---

## Open questions / to refine

_(To be filled during refinement — answers may arrive via chat and can bleed
into other features.)_

### Things Claude wants to ask about

- Scope: which formats are actually in-scope for the VTT, and in what order?
  (Team formats need 4 players and are v2+ networking territory; the current
  MVP is 2-player hotseat.)
- How does the pre-game config screen relate to the **Deckbuilder Overhaul** and
  the existing **Random deck** generator? (Formats imply per-format deck
  minimums/restrictions the builder must enforce.)
- Duel play requires **per-card ownership tracking** and **two decks / two
  discard piles treated as one** — how much of the current single-shared-deck
  engine changes to support this?
- Best-of-three + **sideboarding** (Draft formats) implies a match wrapper above
  the current single-game loop, plus deck editing between games. In scope?
- Draft formats need an **interactive drafting UI** (Quick Draft pass-and-keep;
  Winston pile mechanics with hidden info). Big feature — separate stub?
- "Hurt Feelings is not used in team games" and "Hate/Paranoia can mill you out"
  are card-level rule exceptions — where do format-specific card rules live?
- Team hidden-information rules (Closed Team) depend on v2 hidden-hand
  networking — dependency to note.
