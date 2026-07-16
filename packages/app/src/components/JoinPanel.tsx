import { useState } from 'react';

interface JoinPanelProps {
  /** The single name from the create-game form above — reused so there's one name field. */
  name: string;
  onJoin: (code: string) => void;
  initialCode?: string;
}

/**
 * The "join a game" box beneath the create-game form on the Host-or-Join page. It only
 * needs the host's room code — the player's name comes from the shared "Name" field
 * above, so there's a single name input on the page.
 */
export function JoinPanel({ name, onJoin, initialCode = '' }: JoinPanelProps) {
  const [code, setCode] = useState(initialCode);
  const ready = code.trim().length > 0;
  const submit = () => {
    if (ready) onJoin(code.trim());
  };

  return (
    <section className="panel join-panel">
      <div className="join-panel__head">
        <span className="host-tag host-tag--join">Join</span>
        <div className="join-panel__headtext">
          <h2>Join a game</h2>
          <p className="muted">
            Got a room code from a friend? Enter it to join as{' '}
            <strong>{name.trim() || 'Player 2'}</strong>.
          </p>
        </div>
      </div>
      <div className="join-panel__fields">
        <label>
          Room code
          <input
            className="join__input"
            value={code}
            spellCheck={false}
            autoCapitalize="characters"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            placeholder="ABC123"
          />
        </label>
      </div>
      <button className="btn btn--primary join-panel__cta" disabled={!ready} onClick={submit}>
        Join game
      </button>
    </section>
  );
}
