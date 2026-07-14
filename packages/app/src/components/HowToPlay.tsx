import { Starburst } from './Starburst.js';
import { AnatomyFigure, ExampleFigure, FigureRow } from './rules/figures.js';

const MARO_POST = 'https://magic.wizards.com/en/news/feature/mood-swings-extended-rules';

/** A glossary entry from the extended-rules vocabulary. */
const GLOSSARY: [string, string][] = [
  ['[0]…[6] dice', 'Values 0–12; 7–12 are shown as two dice added together.'],
  ['Additional Mood', 'Permission to play an extra mood this turn (the default is one).'],
  ['After scoring', 'An effect at end of round, after totaling values but before the round ends.'],
  ['Becomes yours', 'You gain a mood permanently; if later sent to a hand it goes to your hand.'],
  ['Card', 'Anything in a hand, the discard pile, or the deck (a card in play is a mood).'],
  ['Copy', 'Your mood takes on all attributes of another mood (dice, color, abilities). It stops being a copy if it leaves play.'],
  ['Deal', 'Distribute cards from a pile to players (e.g. Chaos gathers all moods, shuffles, and deals them out).'],
  ['Discard', 'Moving a card from a hand into the shared discard pile.'],
  ['Even / Odd value', 'Even = divisible by 2 (0, 2, 4…); odd = not (1, 3, 5…).'],
  ['Give / Give back', 'Permanently make one of your cards another player’s, or return a mood to the player you took it from.'],
  ['Hurt Feelings', '(3+ players) the lowest scorer (tie → latest player) may play an additional card next turn.'],
  ['Lose', 'Not having the highest score that round; a losing player draws a card.'],
  ['May', 'Optional.'],
  ['Mood', 'Any card in play. Cards in hand, discard, or deck are not moods.'],
  ['Moodiest', 'The player with the most moods in play.'],
  ['Most common color', 'The color with the most moods in play; ties mean several colors are all "most common".'],
  ['Random', 'No conscious choice — shuffle face-down, then pick.'],
  ['Round', 'The period in which each player gets one turn; it ends at scoring.'],
  ['Score', 'Noun: your combined value. Verb: counting a card’s value.'],
  ['Suppress / Suppressed', 'Value drops to [0] while suppressed, but the card is still in play and still counts for "cares about X in play" effects. Turn a suppressed card sideways.'],
  ['Total value [n]', 'A combined value of any number of cards ≤ n (e.g. [2]+[2]+[1] = 5).'],
  ['Turn', 'One person’s play period; each player gets exactly one per round.'],
  ['Value', 'What a card is worth when scored; cards only have a value while in play.'],
  ['Win a round', 'Highest score (tie → the earlier player that round).'],
];

/**
 * The main-menu "How to Play" — a dedicated full-screen view (not a modal). It
 * reconstructs the extended rules (text from docs/RULES.md) with example-card
 * figures drawn by the app's own renderer, and links out to Mark Rosewater's
 * post. Scrolls internally like the StartScreen; it does not sit in the board's
 * fixed no-scroll shell.
 */
export function HowToPlay({ onBack }: { onBack: () => void }) {
  return (
    <div className="howto">
      <header className="howto__header">
        <div className="howto__titles">
          <Starburst className="howto__burst" label="Rules" />
          <div>
            <h1>How to Play</h1>
            <p className="howto__tag">Mood Swings — the extended rules, reconstructed</p>
          </div>
        </div>
        <button className="btn btn--primary" onClick={onBack}>
          ← Back to menu
        </button>
      </header>

      <div className="howto__body">
        <section className="panel howto__sec">
          <p>
            Mood Swings is a shared-deck card game for 2–4 players. Everyone plays emotions
            ("moods") into a common play area and races to have the highest total value each
            round. First to win three rounds wins the game. This reference reconstructs the
            complete extended ruleset; every example card below is drawn with the game's own
            renderer.
          </p>
          <p className="howto__link">
            Original designer notes:{' '}
            <a href={MARO_POST} target="_blank" rel="noreferrer noopener">
              Mark Rosewater — Mood Swings Extended Rules
            </a>
          </p>
        </section>

        <section className="panel howto__sec">
          <h2>Anatomy of a card</h2>
          <p>Each card carries these twelve fields:</p>
          <AnatomyFigure name="Superiority" />
          <p className="muted">
            Values range 0–12. Any value 7–12 is drawn as two dice side by side — add them
            together (e.g. [6][1] = 7).
          </p>
        </section>

        <section className="panel howto__sec">
          <h2>The deck</h2>
          <ul>
            <li>
              A retail box is <strong>45 different cards</strong> (23 common, 14 uncommon, 6
              rare, 2 mythic) — a randomized selection from the full 133-card set.
            </li>
            <li>
              <strong>Customizing:</strong> you may add or remove cards. Two players need a
              minimum of 15 cards; add +15 per additional player (30 for 3p, 45 for 4p). 45 is
              the recommended minimum for 2–4 players.
            </li>
            <li>
              <strong>Duplicates:</strong> the game ships with none, but you may add them. More
              unique cards raise variance; more high-rarity cards make wilder swings.
            </li>
          </ul>
        </section>

        <section className="panel howto__sec">
          <h2>Setup</h2>
          <ol>
            <li>All players share one deck and one discard pile.</li>
            <li>Shuffle, then each player draws five cards.</li>
            <li>
              Reveal the bottom card of the deck. Whoever most recently felt that emotion
              chooses who starts round 1 (or decide randomly).
            </li>
            <li>Track two things: the ongoing score and rounds won (first to 3 rounds wins).</li>
          </ol>
        </section>

        <section className="panel howto__sec">
          <h2>Round structure</h2>
          <ul>
            <li>Each round, the first player takes a turn, then each other player in clockwise order.</li>
            <li>
              On a player's turn only that player takes actions — you never play cards from your
              hand on someone else's turn. (But other players' moods can still move, steal, or
              change the value of your moods.)
            </li>
            <li>After everyone has taken one turn, proceed to scoring. Some effects happen after scoring.</li>
            <li>A <strong>round</strong> is the period in which each player gets one turn; it ends at scoring. A <strong>turn</strong> is one person's play period.</li>
          </ul>
        </section>

        <section className="panel howto__sec">
          <h2>Taking a turn</h2>
          <p>On your turn: play one card or pass. A card you play enters face up and becomes one of your <strong>moods</strong>. Moods persist across rounds unless an effect moves them.</p>

          <h3>The three card-effect types</h3>
          <ol>
            <li>
              <strong>To play this card —</strong> a requirement or cost paid before the card
              enters play (commonly: discard a card, or move some of your moods to the discard
              pile or your hand). Can't pay it? You can't play the card.
            </li>
            <li>
              <strong>While in play —</strong> a continuous effect that can change values or
              bend the rules while the mood stays out.
            </li>
            <li>
              <strong>After playing this mood —</strong> happens after the card enters play.
              Most resolve by end of turn; some keep going while in play (these carry the
              <span className="howto__icon">!</span> reminder icon).
            </li>
          </ol>
          <FigureRow names={['Self-Loathing', 'Patience', 'Disgust', 'Rage']} />
          <p className="muted">
            All cards have at least one of these three abilities except Creativity and the
            common no-text cycle — Creativity copies another mood and gains its abilities.
          </p>
          <FigureRow names={['Creativity']} />

          <h3>Order of operations when you play a mood</h3>
          <ol>
            <li><strong>Pay costs</strong> from "To play this card" before the mood enters play. (Self-Loathing requires putting one or more of your moods into the discard pile first — with no moods in play, you can't play it.)</li>
            <li><strong>Put the mood into play.</strong></li>
            <li><strong>Apply all "While in play" effects.</strong> (Patience enters at its this-turn [1] value; a white value-drop could pull an opponent's Disgust down.)</li>
            <li><strong>Resolve "After playing this mood" effects.</strong> (Rage discards all moods with value [3] or less — evaluated after step 3's values settle.)</li>
            <li><strong>Re-stabilize:</strong> if any card entered or left play during step 4, re-apply "While in play" effects, repeating until values are stable.</li>
          </ol>

          <h3>Worked example — two-part "after playing" cards</h3>
          <p>
            Cards like <strong>Worry</strong> and <strong>Hostility</strong> have two sub-effects: the first
            moves cards between play, hand, and discard; before the second sub-effect (which cares
            about current values) you must let "While in play" effects re-settle.
          </p>
          <p>
            Say an opponent has <strong>Superiority</strong> showing [6][1] because they have the most moods.
            You play Hostility: its while-in-play equalizes the mood counts, so Superiority drops to [3].
            You discard one of your black moods via the first effect — which changes the counts back — so
            Superiority returns to [6][1]. The second effect (hits value [3] or less) can no longer reach it.
          </p>
          <FigureRow names={['Worry', 'Hostility', 'Superiority']} />
        </section>

        <section className="panel howto__sec">
          <h2>Scoring</h2>
          <ul>
            <li>Each player sums the values of all their moods. Highest total wins the round.</li>
            <li>Tie → the player who played the earliest turn that round wins.</li>
            <li>Re-check black-die values at scoring time; white-die values are locked once played (barring outside effects).</li>
            <li>If a card is on its secondary value it's rotated 180° so that value sits top-right; two-dice secondaries add together.</li>
          </ul>
        </section>

        <section className="panel howto__sec">
          <h2>After scoring</h2>
          <p>Resolved before any losing player draws:</p>
          <ol>
            <li>
              Resolve "after scoring" effects in turn order (a player with several chooses their
              own internal order). Keep cycling until all resolve — ownership can change
              mid-resolution, and <strong>Sneakiness</strong> can even change who won, so every
              after-scoring effect must finish first.
            </li>
            <li><strong>Win check:</strong> a player who has won 3 rounds wins the game.</li>
            <li>Otherwise each losing player draws a card.</li>
            <li>(3+ players only) the lowest-scoring player gains <strong>Hurt Feelings</strong> — an extra mood next turn. Tie for lowest → the one who played latest gets it.</li>
            <li>Start the next round with this round's winner going first.</li>
          </ol>
          <p>
            Ordering your own effects matters. With <strong>Recklessness</strong> + <strong>Bashfulness</strong>,
            you might put a borrowed Bashfulness on the bottom of the deck before the "return it to
            its owner" effect, so it's no longer in play to return.
          </p>
          <FigureRow names={['Recklessness', 'Bashfulness', 'Sneakiness']} />
        </section>

        <section className="panel howto__sec">
          <h2>Vocabulary</h2>
          <dl className="howto__glossary">
            {GLOSSARY.map(([term, def]) => (
              <div key={term} className="howto__gloss-row">
                <dt>{term}</dt>
                <dd>{def}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="howto__foot">
          <a href={MARO_POST} target="_blank" rel="noreferrer noopener">
            Read Mark Rosewater's full post ↗
          </a>
          <button className="btn btn--primary" onClick={onBack}>
            ← Back to menu
          </button>
        </footer>
      </div>
    </div>
  );
}
