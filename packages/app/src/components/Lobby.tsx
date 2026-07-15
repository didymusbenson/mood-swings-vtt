import { useState } from 'react';
import { Starburst } from './Starburst.js';
import type { Session } from '../net/session.js';

interface LobbyProps {
  session: Session;
  onCancel: () => void;
}

/**
 * Shown while a networked session has no view yet: the host waits for a joiner
 * (showing the shareable room code) and the joiner waits to connect. Also handles the
 * `lost` state (bad code / disconnect / broker unreachable) with a route back to menu.
 */
export function Lobby({ session, onCancel }: LobbyProps) {
  const lost = session.status === 'lost';
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    if (!session.roomCode) return;
    try {
      await navigator.clipboard.writeText(session.roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the code is on screen to read anyway */
    }
  };

  return (
    <div className="start">
      <header className="start__header">
        <Starburst className="start__burst" label={session.mode === 'host' ? 'Hosting' : 'Joining'} />
        <h1>{lost ? 'Connection lost' : session.mode === 'host' ? 'Waiting for opponent' : 'Connecting…'}</h1>
      </header>

      <section className="panel lobby">
        {lost ? (
          <p className="lobby__error">{session.error ?? 'The connection was lost.'}</p>
        ) : session.mode === 'host' && session.roomCode ? (
          <>
            <p className="lobby__hint">Share this room code with your opponent:</p>
            <button className="lobby__code" onClick={copyCode} title="Click to copy">
              {session.roomCode}
            </button>
            <p className="lobby__sub">{copied ? 'Copied!' : 'The game begins as soon as they join.'}</p>
          </>
        ) : (
          <p className="lobby__hint">Connecting to room {session.roomCode}…</p>
        )}

        <button className="btn" onClick={onCancel}>
          {lost ? 'Back to menu' : 'Cancel'}
        </button>
      </section>
    </div>
  );
}
