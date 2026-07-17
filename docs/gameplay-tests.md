# Gameplay tests — prebuilt deck suite

A suite of 29 prebuilt "test decks" ships in the app so a tester can reproduce
recognisable game scenarios on demand instead of fishing for them in a random
box-collation deck. The decks are defined in
`packages/app/src/game/presetDecks.ts` and are covered by
`presetDecks.test.ts`, which guarantees that **every one of the 133 playable
cards appears in at least one deck.**

This document lists each deck, its five moods, and the validations a tester
should run while playing it.

## How to use

1. **Start screen → Custom deck tab → pick a test deck** from the picker (the
   presets are grouped under *Test decks (prebuilt)*). Start a Playtest /
   goldfish game.
2. Each deck is **5 distinct moods × 3 copies = 15 cards** (the two-player
   minimum). Because every mood runs three copies, any "2+ of a colour" or
   "3 of one colour" condition is satisfied just by the deck *containing* that
   colour — that is how the colour-count decks are built.
3. The deck is **shared** — both seats draw from the same 15 cards. To test an
   effect that reads *an opponent's* board or hand, play moods onto **both**
   sides (Playtest lets you drive both seats).

## General checks (apply to every deck)

- **Live value vs printed value** — inspect a mood and confirm its computed
  value matches the rules text (many cards print one number and score another).
- **Targeting legality** — the effect only offers legal targets; illegal drops
  are rejected.
- **Log fidelity** — every state change writes a clear log line.
- **Redaction** — hidden information (face-down hands, undrawn deck) stays
  hidden from the seat that shouldn't see it.
- **Round scoring** — the correct player wins the round and the running score
  updates.

> Notation below: `#N Name (colour [printed value])`. "→[x]" means the card's
> *live* value should become x when its condition is met.

---

## Black

### Discard Mill — `black-discard-mill`
Moods: `#75 Self-Loathing` · `#74 Sadness` · `#70 Misery` · `#65 Grief` · `#69 Melancholy`

- **Self-Loathing #75** — uncastable with no mood of yours in play; after a mood
  is down, playing it **sacrifices** one of your moods to the discard. Confirm
  the gating and that the sacrificed mood lands in the discard pile.
- **Sadness #74** — reads **[0]** with an empty discard; its live value should
  climb **+2 per card** in the discard as the pile fills.
- **Misery #70** — should become **[8]** once the discard holds **2+ cards
  sharing a colour** (sac two same-colour moods first).
- **Grief #65** — grants up to two "play from discard" actions **only** when
  moods sit in the discard; verify it does nothing on an empty discard.
- **Melancholy #69** — while in play, a mood in the discard becomes playable
  (consuming a normal play). Confirm the permission is continuous and dead with
  an empty discard.

### Corruption & Discard — `black-corruption`
Moods: `#64 Envy` · `#60 Corruption` · `#62 Cynicism` · `#61 Cruelty` · `#57 Bitterness`

- **Envy #64** — requires a second own mood to discard as a cost; its value is
  **+2 per mood the moodiest opponent controls** (so **[0]** against an empty
  opponent). Grow the opponent board and confirm it scales.
- **Corruption #60** — exercise the discard-pull mode (needs a non-empty
  discard); note the "double win" mode needs a fully scored round to observe.
- **Cynicism #62** — should read **3→[6]** when it hands a discard card to an
  opponent; needs both a stocked discard and an opponent.
- **Cruelty #61** — skips you and anyone with fewer than two moods; verify it
  only fires on an opponent holding **2+ moods**.
- **Bitterness #57** — discards every other mood sharing the **most-common
  in-play colour**; stack a colour and confirm the mass discard.

### Go Wide — `black-go-wide`
Moods: `#53 Ambition` · `#77 Superiority` · `#79 Vanity` · `#68 Malice` · `#66 Hate`

- **Ambition #53** — pitches a card to grant an extra mood; use it to build a
  wide board for the payoffs below.
- **Superiority #77** — should read **3→[7]** only while you control **strictly
  more moods than every opponent**; drop below and confirm it falls back.
- **Vanity #79** — base value scales **+1 per own mood**; with an **empty hand**
  it switches to the **×3** mode. Empty your hand (Ambition/Suspicion) and
  confirm the multiplier.
- **Malice #68** — never discards itself; picks colours and hits matching moods
  across all boards. Confirm bigger swings when many moods share its colours.
- **Hate #66** — self-targeting filler; confirm it can bottom-deck itself and
  draw when nothing else is a good target.

### Value Targeting — `black-value-targeting`
Moods: `#76 Spite` · `#73 Rejection` · `#71 Paranoia` · `#78 Suspicion` · `#55 Apathy`

- **Spite #76** — targets an **even-value** mood (Apathy [4], Paranoia [2], or
  Rejection [0] qualify); confirm odd-value moods are not offered.
- **Rejection #73** — returns two other moods that **share a colour or value**;
  with three copies of any mood in play the match is automatic.
- **Paranoia #71 / Suspicion #78** — both may self-target, so they always fire;
  confirm they mine a chosen player's hand and are meant for opponents.
- **Apathy #55** — vanilla body (no ability); confirm it just sits at **[4]**.

### Opponent Harassment — `opponent-harassment`
Moods: `#56 Betrayal` · `#58 Condescension` · `#67 Intimidation` · `#40 Guile` · `#51 Sneakiness`
_Play both seats — every card needs a live opponent._

- **Betrayal #56** — give-then-reclaim; confirm the reclaim only lasts that
  round's scoring and needs a second own mood to give.
- **Condescension #58** — should read **3→[6]** when it gives a hand card to an
  opponent.
- **Intimidation #67** — steals a card from an opponent's hand and plays it as
  an extra mood; needs their hand non-empty.
- **Guile #40** — unplayable unless you can discard two cards **and** an
  opponent has a mood; confirm the mandatory permanent steal.
- **Sneakiness #51** — swaps round scores for the round; verify it only matters
  when the swap changes who leads (make the opponent out-score you first).

### Bounce & Replay — `bounce-replay`
Moods: `#54 Angst` · `#28 Anxiety` · `#98 Rage` · `#48 Panic` · `#80 Anger`

- **Angst #54** — needs one of **your** blue/red moods in play (Anxiety/Rage/
  Anger) **plus** a mood in the discard to replay; confirm both halves.
- **Anxiety #28** — returns up to two players' **odd-value** moods to hand;
  confirm value-4 vanillas are not valid targets.
- **Rage #98** — the "all" mode wipes **every** mood valued ≤3 (including your
  own low ones); confirm the threshold.
- **Panic #48** — returns one mood per player; the easiest disruptor to fire.
- **Anger #80** — grabs moods whose **combined** value is ≤5; confirm it can
  scoop several 0-value moods at once.

---

## Colour-count (rainbow bodies)

### Colour-Count Upgrades — `color-upgrades`
Moods: `#47 Obsession` · `#72 Pity` · `#88 Excitement` · `#115 Enjoyment` · `#112 Determination`

Play a few of each mood so all colours are on the board, then confirm each
climbs:
- **Obsession #47** → **[6]** with 2+ white/black moods in play.
- **Pity #72** → **[6]** with 2+ blue/red moods.
- **Excitement #88** → **[6]** with 2+ black/green moods.
- **Enjoyment #115** → **[6]** with 2+ red/white moods.
- **Determination #112** → **[6]** with 3+ moods of any one colour (three copies
  of any green here suffice).

### Colour-Count Downgrades — `color-downgrades`
Moods: `#9 Discipline` · `#27 Ambivalence` · `#63 Disgust` · `#90 Frustration` · `#113 Disregard`

A full rainbow board. Each prints **[6]** and should **drop to [3]**:
- **Discipline #9** — with 2+ black/red moods.
- **Ambivalence #27** — with 2+ red/green moods.
- **Disgust #63** — with 2+ green/white moods.
- **Frustration #90** — with 2+ white/blue moods.
- **Disregard #113** — with 2+ blue/black moods.

Verify each stays at **[6]** until its colours are present, then falls to **[3]**.

### Suppression & Colour Politics — `suppression-politics`
Moods: `#14 Guilt` · `#41 Hesitation` · `#59 Contempt` · `#91 Fury` · `#122 Happiness`

- **Guilt #14** — sustained suppression of black/red moods while in play.
- **Hesitation #41** — returns one (or, in "all" mode, every) red/green mood.
- **Contempt #59** — targets green/white moods; "all" mode wants several.
- **Fury #91** — every player dumps their current-highest mood (can hit Fury
  itself); best with both boards populated.
- **Happiness #122** → **[8]** when one player controls **both a red and a white**
  mood; arrange that and confirm the swing.

---

## White

### Discard & Redistribute — `white-discard`
Moods: `#1 Altruism` · `#8 Dignity` · `#10 Disillusionment` · `#25 Shame` · `#3 Charity`

- **Dignity #8** — discards a [0]–[3] card from hand (seeds the discard).
- **Shame #25** — discards a hand card, then suppresses other moods sharing that
  card's **printed** colour; confirm same-colour board moods are hit.
- **Disillusionment #10** — each player picks a colour; matching other moods go
  to discard.
- **Altruism #1** — its value becomes **[7]** and it redistributes the discard
  **only if the discard is non-empty when it resolves**; play a discard-maker
  first, then confirm.
- **Charity #3** — free extra mood; self-contained enabler.

### High Value & Suppression — `white-high-value`
Moods: `#7 Courage` · `#19 Meekness` · `#21 Patience` · `#24 Scorn` · `#46 Neurosis`

- **Neurosis #46** — prints **[5]** and costs one of your own moods to play; it
  supplies the high-value body the punishers below want.
- **Courage #7** — reads/acts on moods worth **[5]+** in play; confirm it sees
  Neurosis (and an aged Patience).
- **Meekness #19** — suppresses **all** [5]+ moods (including yours) while in
  play.
- **Patience #21** — reads **[1]** the round it's played and **[5]** in later
  rounds; keep it in play across a round boundary and confirm the jump.
- **Scorn #24** — auto-suppresses an eligible same-colour mood when later moods
  are played; needs colour overlap on the board.

### Secondary Values & Grants — `white-secondary`
Moods: `#11 Encouragement` · `#16 Idealism` · `#13 Friendliness` · `#17 Kindness` · `#4 Chivalry`

- **Encouragement #11** — boosts a mood that **has a secondary value** (Chivalry,
  Loyalty-like, or Idealism); confirm it only helps when the secondary exceeds
  the current value.
- **Idealism #16** — raises **your** secondary-value moods; confirm it only
  touches your side, and its own extra-mood grant.
- **Friendliness #13** — grants an extra mood off an **even-printed** card in
  hand; **Kindness #17** off an **odd-printed** card. Confirm each reads the
  **printed** top-right value, not the modified one.
- **Chivalry #4** — carries a secondary value ([5]) that turns on when you did
  **not** go first; also a valid Encouragement target.

### Politics & Suppression — `white-politics`
Moods: `#15 Honor` · `#22 Pride` · `#20 Pacifism` · `#6 Conviction` · `#23 Repentance`
_Play both seats._

- **Honor #15** — forces a chosen player to go first each round while in play;
  confirm it changes turn order (and interacts with Chivalry elsewhere).
- **Pride #22** — lets you keep playing moods while a chosen opponent has **more
  moods than you**; re-checked live.
- **Pacifism #20** — targets **opponents only** (cannot self-target); sustained
  suppression.
- **Conviction #6** — owner bottom-decks the target and draws; show the
  cross-player case against an opponent mood.
- **Repentance #23** — suppresses all moods of a chosen **value** for the round;
  pick the most common value on the board.

### Extra-Mood Chains — `white-chains`
Moods: `#26 Validation` · `#12 Faith` · `#2 Benevolence` · `#38 Fear` · `#124 Hope`

- **Validation #26** — each subsequent **[0]/[1]** mood you play grants another
  play; load the hand with Fear/Hope [0]s and confirm the chain.
- **Faith #12** — discards a **blue or green** card from hand (Fear/Hope) and
  suppresses a mood while in play.
- **Benevolence #2** — grants a bonus mood for an **off-colour** (non-white) mood
  in hand; Fear (blue) / Hope (green) satisfy it.
- **Fear #38** — always grants +1 mood; with a second own mood down, confirm the
  optional "return your mood" half.
- **Hope #124** — recurring extra play each of your turns given a spare card.

---

## Blue

### Return & Value-Match — `blue-bounce`
Moods: `#34 Denial` · `#35 Disorientation` · `#39 Fickleness` · `#33 Curiosity` · `#42 Imagination`

- **Imagination #42** — recolours **all** moods to one colour while in play, and
  a later Imagination overrides an earlier one; this is the enabler for the rest.
- **Fickleness #39** — returns every mood sharing the **plurality colour** except
  itself; use Imagination to force a colour.
- **Denial #34** — returns two moods sharing a **colour or value**; three copies
  make the match trivial.
- **Curiosity #33** → **[6]** when a chosen player's random hand card shares a
  colour with any mood in play.
- **Disorientation #35** — returns all other moods of a chosen **value**;
  value-4 is the fattest bucket.

### Extra Moods & Theft — `blue-chains`
Moods: `#37 Duplicity` · `#45 Insecurity` · `#50 Regret` · `#43 Indecisiveness` · `#32 Creativity`

- **Duplicity #37** — grants +1 mood, then **doubles** the "after playing"
  effects of later moods this turn; confirm the doubling.
- **Insecurity #45** — grants +1 mood, then returns **that** mood to hand after
  scoring.
- **Regret #50** — unplayable without **two** of your own moods to bounce; then
  steals an opponent mood to your hand.
- **Indecisiveness #43** — forces a random return from each opponent holding
  **2+ moods**; build an opponent board first.
- **Creativity #32** — copies a mood already in play (dice/colour/abilities);
  confirm it adopts a strong target, and is plain **[0]** if it copies nothing.

### Hand Disruption — `blue-disruption`
Moods: `#29 Avoidance` · `#31 Confusion` · `#36 Doubt` · `#49 Rationalization` · `#30 Bashfulness`
_Play both seats._

- **Avoidance #29** — mandatory directional mood pass; a player with no moods
  passes nothing.
- **Confusion #31** — mandatory hand-card pass; empty hands pass nothing.
- **Doubt #36** — reveal → bottom-deck → redraw fires off hand cards; the
  **colour ban** only bites the **following** round.
- **Rationalization #49** — recycle-your-hand half works solo; the pass-all-hands
  half needs a live multiplayer table.
- **Bashfulness #30** — bottom-decks and draws **only if you lead at scoring the
  round you play it**; secure the win and confirm.

### Tempo & Doubling — `blue-tempo`
Moods: `#18 Loyalty` · `#52 Worry` · `#44 Indifference` · `#108 Bliss` · `#128 Nostalgia`

- **Loyalty #18** → **[6]** with 2+ green/blue moods (Bliss/Nostalgia +
  Indifference).
- **Worry #52** — costs one of **your white/black** moods (Loyalty is white),
  then returns up to two moods valued ≤3; confirm values re-settle mid-effect.
- **Bliss #108** — discards a hand card, then **doubles** your moods sharing that
  card's colour; needs 2+ of that colour on your side.
- **Nostalgia #128** — retrieve half needs a stocked discard; extra-play half
  needs a spare hand card.
- **Indifference #44** — vanilla body at **[4]**.

---

## Red

### Board Wipes — `red-wipe`
Moods: `#105 Wrath` · `#99 Rebellion` · `#101 Shock` · `#85 Chaos` · `#92 Glee`

- **Wrath #105** — "all" mode wipes **every** other mood; best with a full board.
- **Rebellion #99** — choose a value in {0–3}; discards all other moods at exactly
  that value.
- **Shock #101** — up to two players each lose a mood valued ≤3.
- **Chaos #85** — reshuffles/redeals all moods in turn order; only visibly does
  something with several moods across both players.
- **Glee #92** — spikes to **[6]** the round it's played, dropping to **[0]** if
  it persists into later rounds; confirm both.

### Own-Board Sacrifice — `red-sacrifice`
Moods: `#89 Exhilaration` · `#95 Infatuation` · `#103 Thrill` · `#84 Bravado` · `#96 Instability`
_Build your own board first — every card needs your moods in play._

- **Exhilaration #89** — unplayable with no own mood; **doubles all your moods'**
  values at scoring.
- **Infatuation #95** — discards **two** of your moods for **[9]** ([6][3]).
- **Thrill #103** — returns your moods to hand for an equal number of extra
  plays; confirm the replay budget.
- **Bravado #84** — needs a prior own mood to sacrifice plus a card in hand for
  the extra play.
- **Instability #96** — swaps one of your moods for one of an opponent's (from a
  2+-mood opponent).

### Opponent Pressure — `red-pressure`
Moods: `#81 Animosity` · `#82 Arrogance` · `#86 Compulsion` · `#97 Passion` · `#44 Indifference`
_Play both seats; keep the opponent's hand stocked._

- **Animosity #81** → **[5]** while an opponent holds **3+ hand cards**.
- **Arrogance #82** — steals while an opponent controls a **white/blue** mood
  (Indifference supplies a blue one); the steal returns on leave-play.
- **Compulsion #86** — mandatory take while the opponent has **≥1 hand card**.
- **Passion #97** — auto-adds an opponent's **single best mood value** to your
  score (they keep the mood); needs an opponent mood valued >0.
- **Indifference #44** — vanilla blue body enabling Arrogance/Passion.

### Hand Manipulation — `red-hand`
Moods: `#87 Embarrassment` · `#93 Gluttony` · `#106 Zeal` · `#102 Stubbornness` · `#83 Boredom`

- **Embarrassment #87** → **[5]** when you have a card **printed [4]/[5]/[6] in
  hand** (Boredom [4]); confirm the card must be in **hand**, not play.
- **Gluttony #93** — grants +1 play; the extra mood is auto-discarded after
  scoring.
- **Zeal #106** — bottom-decks a hand card and draws one; needs a spare card and
  a non-empty deck.
- **Stubbornness #102** — recurring +1 play **whenever** you're behind on mood
  count; put the opponent ahead and confirm.
- **Boredom #83** — vanilla body at **[4]**, doubling as Embarrassment's fuel.

### Sacrifice & Steal — `red-sacrifice-steal`
Moods: `#94 Hostility` · `#100 Recklessness` · `#104 Triumph` · `#124 Hope` · `#55 Apathy`

- **Hostility #94** — sacrifices one of **your black/green** moods (Apathy/Hope),
  then shrinks up to two moods currently valued ≤3; confirm the two phases
  (values re-settle between sac and targeting).
- **Recklessness #100** — the bottom-deck-and-draw always fires; the **steal a
  mood** half needs an opponent mood.
- **Triumph #104** → **[5]** automatically when its owner went **first** this
  round; seat that player first.
- **Hope #124 / Apathy #55** — the green/black sacrifice fodder and a [4] body.

---

## Green

### Discard Engine — `green-discard`
Moods: `#110 Cheer` · `#111 Delight` · `#121 Grace` · `#123 Harmony` · `#132 Vulnerability`

- **Cheer #110** — discards a **[0]/[2]/[4]/[6]**-printed card to boost; **Delight
  #111** discards a **[1]/[3]/[5]**-printed card. Together they seed the discard.
- **Grace #121** — recurring extra play **from the discard**, colour-locked to
  your moods' colours (green discards qualify); needs a stocked discard.
- **Harmony #123** — replay **any** discard mood (no colour lock).
- **Vulnerability #132** → **[7]** off a discard that happened **this round**;
  confirm it resets each round (timing matters).

### Count & Parity — `green-count`
Moods: `#116 Enthusiasm` · `#117 Euphoria` · `#129 Serenity` · `#131 Tranquility` · `#133 Wonder`
_Flood the board with green moods._

- **Euphoria #117** — value scales **+1 per mood** in play (all players);
  suppression forces it to **[0]**.
- **Serenity #129** → **[6]** while you control an **even** number of moods;
  **Tranquility #131** → **[6]** while you control an **odd** number. They can't
  both peak at once — confirm each flips at the right parity.
- **Enthusiasm #116** — scores 0 itself but **doubles your best mood** at scoring.
- **Wonder #133** — pick your most-populous colour; value is **+2 per** matching
  in-play mood **and** matching discard card.

### Extra Plays — `green-extra-plays`
Moods: `#114 Eagerness` · `#125 Joy` · `#130 Sloth` · `#120 Generosity` · `#119 Fondness`

- **Eagerness #114** — grants a colour-locked extra play for a hand card sharing
  a colour with one of your moods.
- **Joy #125** — one-time extra play **next** turn; needs the game to continue
  and a card to spend.
- **Generosity #120** — folds an extra play into an **opponent's** next-turn
  budget (value fixed at [6]).
- **Sloth #130** — value scales with **your hand size**; suppression forces [0].
- **Fondness #119** → **[7]** when **every** player controls **3+ moods**; use the
  extra-play grants to flood both sides, then confirm.

### Scoring Tricks — `green-scoring-tricks`
Moods: `#107 Awe` · `#118 Fascination` · `#108 Bliss` · `#128 Nostalgia` · `#55 Apathy`
_Play both seats for Fascination._

- **Awe #107** — cancels this round's scoring and lets you pick the next first
  player; confirm scoring is skipped for the round.
- **Fascination #118** → **[7]** when you reveal a **blue/black** hand card
  (Apathy) and give it to another player.
- **Bliss #108 / Nostalgia #128** — discard doubler and discard retriever (see
  their notes above); here they work the pile for Awe/Fascination turns.
- **Apathy #55** — black body Fascination can give away.

---

## Rainbow marquee

### Five-Colour Payoff (Love) — `rainbow-love`
Moods: `#5 Complacency` · `#44 Indifference` · `#55 Apathy` · `#83 Boredom` · `#127 Love`

- **Love #127** → **[12]** when a white, blue, black, red **and** green mood are
  all in play (Love itself supplies green). Get one of each colour down — the
  four vanillas are exactly one per non-green colour — and confirm the jump; drop
  a colour and confirm it falls back.
- The four vanillas (**#5/#44/#55/#83**) should sit inert at **[4]** — a clean
  five-colour board with no ability noise. This deck also doubles as a baseline
  "clean bodies" deck for ad-hoc testing.

### Colour Diversity — `color-diversity`
Moods: `#109 Celebration` · `#126 Laziness` · `#16 Idealism` · `#38 Fear` · `#74 Sadness`
_Play both seats and keep your side more colourful than the opponent's._

- **Celebration #109** → **[7]** while you control **strictly more distinct mood
  colours than every opponent**; it's a colour-diversity race, so arrange an
  asymmetric board and confirm the boost turns off when the opponent catches up.
- **Idealism #16 / Fear #38 / Sadness #74** — cheap **[0]** bodies of three
  different colours to build the spread; **Laziness #126** is a green [4] body.
