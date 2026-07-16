import { Starburst } from './Starburst.js';

export type PlayMode = 'goldfish' | 'online' | 'deckbuilder';

interface ModeChooserProps {
  onPick: (mode: PlayMode) => void;
}

/**
 * The top-level entry point (v2): pick how to play.
 *
 *   Host or Join — networked two-player game. One page: create a new game (get a room
 *                  code to share) or join a friend's with their code.
 *   Goldfish     — one screen, one driver, both hands visible (the old hotseat, for
 *                  practicing a deck / seeing how cards interact solo).
 *
 * "Vs Computer" is intentionally absent: the AI is deferred, so there is no button for
 * it until a brain exists (see net/agent.ts ComputerAgent).
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
          <span className="modecard__title">Host or Join</span>
          <span className="modecard__desc">
            Play a friend online. Host a new game and share a room code, or join theirs with a code.
          </span>
        </button>

        <button className="modecard modecard--secondary" onClick={() => onPick('goldfish')}>
          <span className="modecard__icon" aria-hidden>
            🐟
          </span>
          <span className="modecard__title">Goldfish</span>
          <span className="modecard__desc">
            Play both sides on one screen to practice a deck and see how cards interact.
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
