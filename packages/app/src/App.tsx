import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type React from 'react';
import { Engine } from '@mood-swings/engine';
import { db } from './game/db.js';
import { StartScreen, type StartConfig } from './components/StartScreen.js';
import { GameBoard } from './components/GameBoard.js';
import { ModeChooser, type PlayMode } from './components/ModeChooser.js';
import { OnlineSetup } from './components/OnlineSetup.js';
import { Lobby } from './components/Lobby.js';
import { DelegatedChoiceOverlay } from './components/DelegatedChoiceOverlay.js';
import { GoldfishSession, HostSession, JoinSession, type Session } from './net/session.js';
import { generateRoomCode } from './net/peer.js';

type Screen = 'menu' | PlayMode;

/** Read a `#room=CODE` deep link so a shared join URL lands straight on the join screen. */
function roomFromHash(): string | null {
  const m = /[#&]room=([^&]+)/i.exec(window.location.hash);
  return m ? decodeURIComponent(m[1]!) : null;
}

export function App() {
  const engine = useMemo(() => new Engine(db), []);
  const deepLinkCode = useMemo(roomFromHash, []);
  const [screen, setScreen] = useState<Screen>(deepLinkCode ? 'online' : 'menu');
  const [session, setSession] = useState<Session | null>(null);
  // Setup-time error (bad deck, etc.); in-match/connection errors live on session.error.
  const [setupError, setSetupError] = useState<string | null>(null);

  // Sessions are imperative objects that mutate their own view/status/error; force a
  // re-render whenever one notifies so React re-reads them.
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!session) return;
    return session.subscribe(bump);
  }, [session]);

  // Tear a session down if the component unmounts mid-match.
  useEffect(() => () => session?.teardown(), [session]);

  const startGoldfish = useCallback(
    (config: StartConfig) => {
      try {
        setSession(new GoldfishSession(engine, engine.setup(config)));
        setSetupError(null);
      } catch (e) {
        setSetupError(e instanceof Error ? e.message : String(e));
      }
    },
    [engine],
  );

  const startHost = useCallback(
    (config: StartConfig) => {
      try {
        setSession(new HostSession(engine, engine.setup(config), generateRoomCode()));
        setSetupError(null);
      } catch (e) {
        setSetupError(e instanceof Error ? e.message : String(e));
      }
    },
    [engine],
  );

  const startJoin = useCallback((code: string, name: string) => {
    setSession(new JoinSession(code, name));
    setSetupError(null);
  }, []);

  const leave = useCallback(() => {
    session?.teardown();
    setSession(null);
    setScreen('menu');
    setSetupError(null);
    // Drop a stale #room= so "New game" doesn't bounce back to join.
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, [session]);

  const view = session?.view ?? null;
  const error = setupError ?? session?.error ?? null;
  const dismissError = useCallback(() => {
    setSetupError(null);
    session?.clearError();
  }, [session]);

  let body: React.ReactNode;
  if (session && view) {
    body = (
      <GameBoard
        state={view}
        onAction={(a) => session.submit(a)}
        onNewGame={leave}
        localSeat={session.localSeat}
        viewerSeat={session.viewerSeat}
        delegate={session.delegatesChoices}
      />
    );
  } else if (session) {
    // A networked session with no view yet: host waiting / joiner connecting / lost.
    body = <Lobby session={session} onCancel={leave} />;
  } else if (screen === 'menu') {
    body = <ModeChooser onPick={setScreen} />;
  } else if (screen === 'goldfish') {
    body = <StartScreen onStart={startGoldfish} onBack={() => setScreen('menu')} />;
  } else {
    // Host or Join, one page: shared name + create-game form on top, join box beneath.
    body = (
      <OnlineSetup
        onHost={startHost}
        onJoin={startJoin}
        onBack={() => setScreen('menu')}
        initialCode={deepLinkCode ?? ''}
      />
    );
  }

  return (
    <div className="app">
      {body}

      {session && view && session.pendingChoice && (
        <DelegatedChoiceOverlay
          request={session.pendingChoice}
          view={view}
          localSeat={session.localSeat}
          onAnswer={(choices) => session.answerChoice(choices)}
        />
      )}

      {session && view && session.waitingForChoice && !session.pendingChoice && (
        <div className="waiting-banner" role="status">
          Waiting for your opponent to choose…
        </div>
      )}

      {error && (
        <div className="toast" role="alert">
          <span className="toast__msg">{error}</span>
          <button className="toast__close" onClick={dismissError} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
