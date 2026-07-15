import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type React from 'react';
import { Engine } from '@mood-swings/engine';
import { db } from './game/db.js';
import { StartScreen, type StartConfig } from './components/StartScreen.js';
import { GameBoard } from './components/GameBoard.js';
import { ModeChooser, type PlayMode } from './components/ModeChooser.js';
import { GoldfishSession, type Session } from './net/session.js';

type Screen = 'menu' | PlayMode;

export function App() {
  const engine = useMemo(() => new Engine(db), []);
  const [screen, setScreen] = useState<Screen>('menu');
  const [session, setSession] = useState<Session | null>(null);
  // Setup-time error (bad deck, etc.); in-match errors live on session.error.
  const [setupError, setSetupError] = useState<string | null>(null);

  // Sessions are imperative objects that mutate their own view/status/error; force a
  // re-render whenever one notifies so React re-reads them.
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!session) return;
    return session.subscribe(bump);
  }, [session]);

  const startLocalMatch = useCallback(
    (config: StartConfig) => {
      try {
        const initial = engine.setup(config);
        setSession(new GoldfishSession(engine, initial));
        setSetupError(null);
      } catch (e) {
        setSetupError(e instanceof Error ? e.message : String(e));
      }
    },
    [engine],
  );

  const leave = useCallback(() => {
    session?.teardown();
    setSession(null);
    setScreen('menu');
    setSetupError(null);
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
      />
    );
  } else if (screen === 'menu') {
    body = <ModeChooser onPick={setScreen} />;
  } else if (screen === 'goldfish') {
    body = <StartScreen onStart={startLocalMatch} onBack={() => setScreen('menu')} />;
  } else {
    // Host / Join transport lands in Phase 2.
    body = (
      <div className="start">
        <div className="start__hero">
          <p className="start__tag">Networked play is coming next.</p>
        </div>
        <button className="btn btn--primary" onClick={() => setScreen('menu')}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      {body}

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
