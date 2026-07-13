import type { Action, GameState, Mood, PlayerState } from '@mood-swings/engine';
import { ROUNDS_TO_WIN } from '@mood-swings/engine';
import { db } from '../game/db.js';
import { Card } from './Card.js';

interface GameBoardProps {
  state: GameState;
  onAction: (action: Action) => void;
  onNewGame: () => void;
}

function liveScore(state: GameState, pid: string): number {
  const scored = state.roundScores[pid];
  if (scored !== undefined) return scored;
  return (state.moods[pid] ?? []).reduce((s, m) => s + m.currentValue, 0);
}

function RoundPips({ won }: { won: number }) {
  return (
    <span className="pips" title={`${won} / ${ROUNDS_TO_WIN} rounds`}>
      {Array.from({ length: ROUNDS_TO_WIN }, (_, i) => (
        <span key={i} className={i < won ? 'pip is-on' : 'pip'} />
      ))}
    </span>
  );
}

function PlayerPanel({
  player,
  state,
  onAction,
}: {
  player: PlayerState;
  state: GameState;
  onAction: (action: Action) => void;
}) {
  const pid = player.id;
  const isActive = state.activePlayer === pid && state.phase === 'awaitingPlay';
  const moods: Mood[] = state.moods[pid] ?? [];
  const hand = state.hands[pid] ?? [];

  return (
    <section className={isActive ? 'player player--active' : 'player'}>
      <header className="player__head">
        <div className="player__id">
          <h2>{player.name}</h2>
          <RoundPips won={player.roundsWon} />
        </div>
        <div className="player__score">
          <span className="player__score-num">{liveScore(state, pid)}</span>
          <span className="player__score-lbl">score</span>
        </div>
        {isActive && <span className="turn-badge">Your turn</span>}
      </header>

      <div className="zone">
        <h3 className="zone__label">Moods in play ({moods.length})</h3>
        <div className="zone__cards">
          {moods.length === 0 && <p className="muted">No moods yet.</p>}
          {moods.map((m) => (
            <Card key={m.uid} card={db.get(m.card)} mood={m} value={m.currentValue} />
          ))}
        </div>
      </div>

      <div className="zone">
        <h3 className="zone__label">
          Hand ({hand.length})
          {isActive && (
            <button className="btn btn--pass" onClick={() => onAction({ type: 'pass', player: pid })}>
              Pass
            </button>
          )}
        </h3>
        <div className="zone__cards">
          {hand.length === 0 && <p className="muted">Empty hand.</p>}
          {hand.map((card, idx) => (
            <Card
              key={`${card}-${idx}`}
              card={db.get(card)}
              disabled={!isActive}
              onClick={isActive ? () => onAction({ type: 'play', player: pid, card }) : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function GameBoard({ state, onAction, onNewGame }: GameBoardProps) {
  const active = state.players.find((p) => p.id === state.activePlayer);
  const gameOver = state.phase === 'gameOver';
  const winnerName = state.players.find((p) => p.id === state.winner)?.name;

  return (
    <div className="board">
      <header className="board__banner">
        <div className="board__round">
          <strong>Round {state.round}</strong>
          <span className="board__phase">{state.phase}</span>
        </div>
        {!gameOver && active && (
          <div className="board__turn">
            Turn: <strong>{active.name}</strong>
          </div>
        )}
        {gameOver && (
          <div className="board__gameover">
            <strong>{winnerName} wins the game!</strong>
            <button className="btn btn--primary" onClick={onNewGame}>
              New game
            </button>
          </div>
        )}
      </header>

      <div className="board__players">
        {state.players.map((p) => (
          <PlayerPanel key={p.id} player={p} state={state} onAction={onAction} />
        ))}
      </div>

      <aside className="board__side">
        <div className="panel shared">
          <h3>Shared</h3>
          <div className="shared__row">
            <span className="chip">Deck: {state.deck.length}</span>
            <span className="chip">Discard: {state.discard.length}</span>
          </div>
          <h4 className="shared__label">Discard pile</h4>
          <div className="shared__discard">
            {state.discard.length === 0 && <span className="muted">empty</span>}
            {state.discard.map((n, i) => (
              <span key={`${n}-${i}`} className="discard__item">
                {db.get(n).name}
              </span>
            ))}
          </div>
        </div>

        <div className="panel log">
          <h3>Activity log</h3>
          <ol className="log__list">
            {[...state.log]
              .slice()
              .reverse()
              .map((entry, i) => (
                <li key={state.log.length - i}>
                  <span className="log__round">R{entry.round}</span> {entry.message}
                </li>
              ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}
