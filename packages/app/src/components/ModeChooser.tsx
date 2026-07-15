import { Starburst } from './Starburst.js';

export type PlayMode = 'goldfish' | 'host' | 'join';

interface ModeChooserProps {
  onPick: (mode: PlayMode) => void;
}

/**
 * The top-level entry point (v2): pick how to play before configuring a game.
 *
 *   Goldfish  — one screen, one driver, both hands visible (the old hotseat, for
 *               testing card interactions solo).
 *   Host Game — host a networked 2-player game; share a room code with a friend.
 *   Join Game — enter a room code to join someone else's game.
 *
 * "Vs Computer" is intentionally absent: the AI is deferred, so there is no button
 * for it until a brain exists (see net/agent.ts ComputerAgent).
 */
export function ModeChooser({ onPick }: ModeChooserProps) {
  return (
    <div className="start">
      <div className="start__hero">
        <Starburst className="start__burst" label="Mood Swings" />
        <p className="start__tag">A virtual tabletop for Mood Swings</p>
      </div>

      <div className="modechooser">
        <button className="modecard" onClick={() => onPick('host')}>
          <span className="modecard__icon" aria-hidden>
            🎲
          </span>
          <span className="modecard__title">Host Game</span>
          <span className="modecard__desc">
            Start a two-player game and share a room code with a friend. Hands stay hidden.
          </span>
        </button>

        <button className="modecard" onClick={() => onPick('join')}>
          <span className="modecard__icon" aria-hidden>
            🔗
          </span>
          <span className="modecard__title">Join Game</span>
          <span className="modecard__desc">Enter a friend's room code to join their game.</span>
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
      </div>
    </div>
  );
}
