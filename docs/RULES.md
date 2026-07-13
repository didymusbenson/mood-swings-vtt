# Mood Swings — Extended Rules (reference extraction)

> Source: *Mood Swings Extended Rules*, Mark Rosewater, Apr 30 2026
> (`magic.wizards.com/en/news/feature/mood-swings-extended-rules`), extracted from
> the PDF the user supplied. This is a faithful working reference for building the
> VTT — quotes condensed but mechanically complete. Pages 16–18 of the source were
> junk/blank.

---

## Anatomy of a card

Each card has these fields:

1. **Name** — an emotion or mental state.
2. **Frame / Color** — one of five colors: **white, blue, black, red, green**. Each color has its own frame.
3. **Reminder icon (!)** — an exclamation point shown when the card has an ability that affects the game *while it's in play* (other than the card changing its own value). Cards whose ability only matters the turn they're played do **not** get the icon.
4. **Value** — what the card is worth when scored. Shown as a **die** in the top-right corner:
   - **White die → fixed value** (never changes).
   - **Black die → variable value** (can change; must be re-checked whenever you add up score).
5. **Art** — an early sketch of art from a published *Magic: The Gathering* card.
6. **Rules text** — what the card does. Italic parenthetical text is **reminder text** (clarification, not new rules).
7. **Secondary value** — some cards have a second possible value, printed in the **lower-left corner**. Rotate the card 180° so the active value sits top-right. A secondary value may be shown as **two dice added together** (e.g. `[6][1]` = 7).
8. **First Edition symbol** — marks first printing.
9. **Collector number** — 1 through 134. Numbering goes **by color** (white, blue, black, red, green) then **alphabetically within each color**. **#134 is the headliner** (a foil *Love* with art drawn/signed by Rosewater; 500 copies).
10. **Color (text)** — the color spelled out for accessibility.
11. **Artist**.
12. **Rarity** — common, uncommon, rare, mythic rare (most → least frequent).

> **Values range 0–12.** Any value 7–12 is drawn as two dice side by side (add them). Dice symbols: `[0] [1] [2] [3] [4] [5] [6]`.

---

## The deck

- Retail box = **45 different cards**: **23 common, 14 uncommon, 6 rare, 2 mythic** — a randomized selection from the full **133-card set** (48 common, 40 uncommon, 30 rare, 15 mythic).
- **Customizing:** you may add/remove cards.
  - **2 players → minimum 15 cards.** Add **+15 cards per additional player** (30 for 3p, 45 for 4p). Recommended minimum **45** for 2–4 players.
- **Duplicates:** the game ships with none, but you *may* add them. More unique cards = higher variance (intended to be more fun). More high-rarity cards = wilder swings.

---

## Setup

1. All players **share one deck and one discard pile**.
2. Shuffle; each player **draws 5 cards**.
3. **Reveal the bottom card** of the deck. Whoever **most recently felt that emotion** chooses who starts round 1 (or decide randomly; or, across multiple games, the previous game's loser chooses — after looking at their hand).
4. Track two things: the **ongoing score** and **rounds won** (need 2 tokens per player; first to 3 rounds wins).

---

## Round structure

- Each round: the **first player** takes a turn, then each other player in **clockwise** order.
- During a player's turn **only that player takes actions** — you never play cards from your hand on someone else's turn. (But another player's moods can affect *your* moods: move them, steal them, change their value, etc.)
- After **everyone has taken one turn**, proceed to **scoring**. (Note: some effects happen *after* scoring.)
- **A "round"** = the period in which each player gets one turn. It ends at scoring.
- **A "turn"** = one person's play period. **Each player gets exactly one turn per round** (unless an "additional mood" effect grants more).

---

## Taking a turn

On your turn: **play one card OR pass**.

- To **play a card**, put it into play face up — it becomes one of your **moods**.
- **Moods** = cards *in play*. Cards in hand / discard / deck are just **"cards."**
- Your moods **stay in play** (persist across rounds) unless an effect moves them.

### The three card-effect types (bolded on the card)

1. **To play this card —** a **requirement/cost** to play it. If you can't meet it, you can't play the card. Three most common costs: *discard a card from hand*, *put one or more of your moods into the discard pile*, or *put one or more of your moods into your hand*.
2. **While in play —** a **continuous** effect (may change values or change game rules).
3. **After playing this mood —** happens **after** the card enters play. Most resolve by end of turn; some **continue while in play** (these carry the `!` reminder icon).

> All cards have ≥1 of these three abilities **except Creativity and the common no-text cycle**. (Creativity copies a card and thereby gains that card's abilities.)

### Order of operations when you play a mood

1. **Pay costs** from *"To play this card"* (before the mood enters play). E.g. Self-Loathing requires putting one or more of your moods into the discard pile first; with no moods in play you can't play it.
2. **Put the mood into play.**
3. **Apply all "While in play" effects.** (E.g. playing Patience enters at its `[1]` this-turn value; a white-mood value-drop could reduce an opponent's Disgust from `[6]` to `[3]`.)
4. **Resolve "After playing this mood" effects.** (E.g. Rage discards all moods with value `[3]` or less — evaluated *after* step 3's while-in-play values settle.)
5. **Re-stabilize:** if any card entered/left play during step 4, **re-apply "While in play" effects**, repeating until values are **stable**.

> **Two-part "after playing" cards (Worry, Hostility):** the first sub-effect moves cards between play/hand/discard; before the second sub-effect (which cares about current values) you must **let "While in play" effects re-settle**. Worked example: Hostility's while-in-play equalizes mood counts so Superiority drops to `[3]`, you discard a black mood via the first effect, then counts change back and Superiority returns to `[6][1]`, so the second effect (affects value `[3]` or less) can no longer hit it.

---

## Scoring

- Each player **sums the values of all their moods**. **Highest total wins the round.**
- **Tie →** the player who **played the earliest turn** that round wins. (3+ players: the earliest *play* of the round, not necessarily the first player.)
- Re-check **black-die** values at scoring time (they may have changed). White-die values are locked once played (barring outside effects).
- Secondary values: if a card is on its secondary value, it's rotated 180° so that value is top-right; two-dice secondaries add together. Some white-die cards let you **choose** the secondary value when played (then rotate; it won't change without outside effects). Some rare/mythic black-die cards have a **variable** value that changes as the game progresses (track with a physical die).

---

## After scoring

Resolved **before** any losing player draws:

1. Resolve **"after scoring"** effects in **turn order** (a player with multiple chooses their own internal order). Keep cycling through players until all resolve (ownership can change mid-resolution). **Sneakiness** can change who won, so all after-scoring effects must finish first.
   - Example (Recklessness + Bashfulness): you may order your own effects — e.g. put a borrowed Bashfulness on the bottom of the deck *before* the "return it to its owner" effect, so it's no longer in play to return.
2. **Win check:** if a player has **won 3 rounds → they win the game.**
3. Otherwise **each losing player draws a card.**
4. **(3+ players only)** the **lowest-scoring** player gains **Hurt Feelings** — lets them play **one additional mood** next turn. Tie for lowest → the one who **played latest** gets it.
5. Start the next round with **this round's winner** going first (they also hold the tie-break advantage).

---

## Vocabulary / keyword glossary

*(Terms the engine must understand. These drive card-effect implementation.)*

- **`[0]`…`[6]` dice** — values 0–12; 7–12 shown as two dice added together.
- **Additional Mood** — permission to play an extra mood this turn (default is one).
- **After scoring** — an effect at end of round, after totaling values but before the round ends.
- **Becomes yours** — you gain a mood permanently; if later sent to a hand it goes to *your* hand.
- **Card** — anything in hand/discard/deck (a card *in play* is a **mood**).
- **Choose any number of players** — 0 up to all players, may include yourself.
- **Choose up to two players** — 0, 1, or 2 players, may include yourself.
- **Copy** — your mood takes on all attributes of another mood (dice, color, abilities). Stops being a copy if it leaves play to a hand/discard.
- **Deal** — distribute cards from a pile to players (e.g. Chaos: gather all moods, shuffle, deal them out).
- **Deck** — the shared randomized draw stack.
- **Dice** — the value icon(s), top-right (primary) or lower-left (secondary).
- **Discard / Discarded** — moving a card **from a hand** into the discard pile (those are "discarded cards").
- **Discard Pile** — shared pile for cards leaving play or hand.
- **Even value** — value divisible by 2 (0,2,4,6,8,10,12,…).
- **Give card/mood** — permanently make one of your cards/moods another player's (future hand-returns go to them).
- **Give the mood back** — return a mood to the player you took it from.
- **Have the same value** — two cards whose current values are equal.
- **Hurt Feelings** — (3+ players) ability for the lowest scorer (tie → latest player) to play an additional card next turn.
- **Lose** — not having the highest score that round; a losing player draws a card (3+ players: lowest scorer gains Hurt Feelings).
- **Lower-left corner** — the secondary-value die.
- **May** — optional.
- **Mood** — any card in play (hand/discard/deck cards are not moods).
- **Moodiest** — the player with the most moods in play.
- **Most common color** — the color with the most moods in play; ties mean multiple colors are all "most common."
- **Odd value** — value not divisible by 2 (1,3,5,7,9,11,…).
- **Play a mood** — put a card from hand into play.
- **Play a mood from the discard pile** — same as playing, but sourced from the discard pile.
- **Random** — no conscious choice (shuffle face-down, then pick). E.g. Altruism gives a random card from the discard pile.
- **Round** — period where each player gets one turn; ends at scoring.
- **Score** — (noun) your combined value; (verb) counting a card's value.
- **Scoring** — end-of-turn totaling of all your moods' values.
- **Share a color/value** — two cards of the same color share a color; equal current values share a value.
- **Suppress / Suppressed** — value drops to `[0]` while suppressed (overrides value gained from game elements — e.g. suppressed Sadness is `[0]` regardless of discard size). Duration is either "for the turn" or "as long as the suppressing card stays in play on your side" (stops if that card changes owner). Turn a suppressed card **sideways**. Suppressed cards are **still in play** and still count for "cares about X in play" effects (a suppressed blue card still counts as a blue card in play).
- **Top-right corner** — the main-value die.
- **Total value [n]** — a combined value of any number of cards ≤ n (e.g. Anger discards any number of cards totaling `[5]`; `[2]+[2]+[1]+[0]` = 5).
- **Turn** — one person's play period; each player gets one per round.
- **Turn order** — clockwise order of turns.
- **Value** — what a card is worth when scored; cards only have a value **while in play**.
- **Win/Won a round** — highest score (tie → earlier player that round).

---

## Implications for the VTT engine (design notes)

- **State is server-authoritative and effect-driven.** A card's value is a *computed* property (base die + all applicable "while in play" modifiers + suppression), recomputed to a fixed point after every state change (see the re-stabilize loop).
- **Value model:** `{ base, dieColor: 'white'|'black', secondary?: number|[a,b], variable?: rule }`. White = constant; black = recompute each scoring.
- **Zones:** shared `deck`, shared `discard`, per-player `hand`, per-player `moods` (in play). Moods **persist across rounds**.
- **Effect timing pipeline per play:** payCost → enterPlay → applyWhileInPlay(fixpoint) → afterPlaying → applyWhileInPlay(fixpoint).
- **Round/game loop:** turn (play/pass) → both players acted → scoring (recompute black dice) → after-scoring effects (turn order; Sneakiness can flip the winner) → win check (first to 3) → losers draw → winner starts next round.
- **Ownership** is a first-class per-mood attribute ("becomes yours" / "give" / "give back").
- **Suppression** = a per-mood flag that forces value 0 but preserves color/identity for "counts in play" queries.
- **MVP (2-player) simplifications:** Hurt Feelings and multi-loser draws only apply at 3+ players; 2-player = single loser draws one, no Hurt Feelings.
