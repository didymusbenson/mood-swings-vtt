import { Starburst } from './Starburst.js';

export type PlayMode = 'online' | 'deckbuilder';

interface ModeChooserProps {
  onPick: (mode: PlayMode) => void;
}

/**
 * The top-level entry point (v2): two choices.
 *
 *   Play        — set up a game: host a friend online, join with a code, or playtest
 *                 both sides yourself (goldfish).
 *   Deckbuilder — build, import, and manage your decks.
 */
export function ModeChooser({ onPick }: ModeChooserProps) {
  return (
    <div className="start">
      <div className="start__hero">
        <Starburst className="start__burst" label="Mood Swings" />
        <p className="start__tag">A virtual tabletop for Mood Swings</p>
      </div>

      <div className="modechooser">
        <button className="modecard" onClick={() => onPick('online')}>
          <span className="modecard__icon" aria-hidden>
            🎲
          </span>
          <span className="modecard__title">Play</span>
          <span className="modecard__desc">
            Host a friend online, join with a room code, or playtest both sides yourself.
          </span>
        </button>

        <button className="modecard modecard--secondary" onClick={() => onPick('deckbuilder')}>
          <span className="modecard__icon" aria-hidden>
            🃏
          </span>
          <span className="modecard__title">Deckbuilder</span>
          <span className="modecard__desc">
            Build, import, and manage your decks. Saved decks are ready to pick when you play.
          </span>
        </button>
      </div>
    </div>
  );
}
