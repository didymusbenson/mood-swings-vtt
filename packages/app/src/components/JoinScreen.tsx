import { useState } from 'react';
import { Starburst } from './Starburst.js';

interface JoinScreenProps {
  onJoin: (code: string) => void;
  onBack: () => void;
  initialCode?: string;
}

/** Enter a room code to join a host's game. No deck/name config — the joiner is dealt in. */
export function JoinScreen({ onJoin, onBack, initialCode = '' }: JoinScreenProps) {
  const [code, setCode] = useState(initialCode);
  const trimmed = code.trim();

  return (
    <div className="start">
      <header className="start__header">
        <button className="btn start__back" onClick={onBack}>
          ← Back
        </button>
        <Starburst className="start__burst" label="Join" />
        <h1>Join Game</h1>
        <p className="start__tag">Enter the room code your host shared</p>
      </header>

      <section className="panel join">
        <label className="join__label">
          Room code
          <input
            className="join__input"
            value={code}
            autoFocus
            spellCheck={false}
            autoCapitalize="characters"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && trimmed) onJoin(trimmed);
            }}
            placeholder="ABC123"
          />
        </label>
        <button className="btn btn--primary" disabled={!trimmed} onClick={() => onJoin(trimmed)}>
          Join
        </button>
      </section>
    </div>
  );
}
