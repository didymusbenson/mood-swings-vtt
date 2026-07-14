// The simplified rules, transcribed verbatim from the physical rules card + card
// back (see docs/features/rules-reference.md). Shared as data so the in-game (?)
// modal renders a single source of truth. NOTE: simplified-only — no jump-off to
// the full rules view or any external site (deliberate: never disrupt game state).

export interface RuleSection {
  title: string;
  body: string;
}

export const SIMPLIFIED_RULES: RuleSection[] = [
  {
    title: 'Setup',
    body: 'All players share the same deck and discard pile. Shuffle the deck, then each player draws five cards. Reveal the bottom card of the deck. The player who most recently felt that emotion goes first in round 1.',
  },
  {
    title: 'Round Structure',
    body: 'Each round, the first player takes their turn, then each other player takes a turn in clockwise order. After everyone has taken a turn, proceed to scoring.',
  },
  {
    title: 'Taking a Turn',
    body: 'On your turn, you may play one card or pass the turn. To play a card, put it into play face up. It becomes one of your moods. Most cards have special effects which can break the rules of the game, so read them carefully! Your moods stay in play unless an effect puts them elsewhere.',
  },
  {
    title: 'Scoring',
    body: "Each card has a value, shown by the die in its top-right corner. That value can change due to card effects. Each player scores by adding up the values of each of their moods. The player with the highest total value wins the round. If there's a tie, whoever took a turn earliest this round wins the tie.",
  },
  {
    title: 'After Scoring',
    body: 'If a player has won three rounds, they win the game! Otherwise: each player who lost the round draws a card. In a 3+ player game, the player with the lowest score this round gets "Hurt Feelings" which allows them to play an additional mood during their next turn. Start a new round with the player who won this round going first.',
  },
];

/** The simplified-rules body, shared by the in-game modal. */
export function SimplifiedRulesBody() {
  return (
    <div className="rules-simple">
      <p className="rules-simple__lede">Mood Swings Rules (2–4 Players)</p>
      {SIMPLIFIED_RULES.map((s) => (
        <section key={s.title} className="rules-simple__sec">
          <h3 className="rules-simple__title">{s.title}</h3>
          <p className="rules-simple__body">{s.body}</p>
        </section>
      ))}
    </div>
  );
}
