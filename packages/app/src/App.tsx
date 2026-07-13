import { useCallback, useMemo, useState } from 'react';
import type { Action, GameState } from '@mood-swings/engine';
import { Engine } from '@mood-swings/engine';
import { db } from './game/db.js';
import { StartScreen, type StartConfig } from './components/StartScreen.js';
import { GameBoard } from './components/GameBoard.js';

export function App() {
  const engine = useMemo(() => new Engine(db), []);
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startGame = useCallback(
    (config: StartConfig) => {
      try {
        const next = engine.setup({
          players: config.players,
          deck: config.deck,
          seed: config.seed,
        });
        setState(next);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [engine],
  );

  const dispatch = useCallback(
    (action: Action) => {
      if (!state) return;
      try {
        // engine.apply is pure: on success we swap in the new state; on an
        // illegal action it throws and we keep the previous state.
        const next = engine.apply(state, action);
        setState(next);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [engine, state],
  );

  const newGame = useCallback(() => {
    setState(null);
    setError(null);
  }, []);

  return (
    <div className="app">
      {state ? (
        <GameBoard state={state} onAction={dispatch} onNewGame={newGame} />
      ) : (
        <StartScreen onStart={startGame} />
      )}

      {error && (
        <div className="toast" role="alert">
          <span className="toast__msg">{error}</span>
          <button className="toast__close" onClick={() => setError(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
