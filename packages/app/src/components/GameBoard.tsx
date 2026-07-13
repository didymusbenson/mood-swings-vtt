import type React from 'react';
import type { Action, GameState, Mood, PlayerState } from '@mood-swings/engine';
import { ROUNDS_TO_WIN } from '@mood-swings/engine';
import { db } from '../game/db.js';
import { Card } from './Card.js';
import { usePlayInteraction, type PlayController } from '../hooks/usePlayInteraction.js';

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

/** Suppress default so a drop is allowed on this element. */
function allowDrop(e: React.DragEvent) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function PlayerPanel({
  player,
  state,
  pc,
}: {
  player: PlayerState;
  state: GameState;
  pc: PlayController;
}) {
  const pid = player.id;
  const isActive = state.activePlayer === pid && state.phase === 'awaitingPlay';
  const moods: Mood[] = state.moods[pid] ?? [];
  const hand = state.hands[pid] ?? [];

  const dragging = pc.dragCard != null;
  const playerIsLegal = pc.playerHighlighted(pid);
  const playerIsSelected = pc.playerSelected(pid);

  const panelClasses = [
    'player',
    isActive ? 'player--active' : '',
    playerIsLegal ? 'player--target' : '',
    playerIsSelected ? 'player--target-selected' : '',
    dragging && !playerIsLegal ? 'player--dim' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      className={panelClasses}
      onDragOver={dragging ? allowDrop : undefined}
      onDrop={dragging ? () => pc.dropOnPlayer(pid) : undefined}
      onClick={playerIsLegal ? () => pc.onPlayerClick(pid) : undefined}
    >
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
          {moods.map((m) => {
            const legal = pc.moodHighlighted(m.uid);
            const clickable = legal && pc.dragCard == null; // clicking picks a flow target
            return (
              <div
                key={m.uid}
                className="mood-drop"
                onDragOver={dragging ? allowDrop : undefined}
                onDrop={
                  dragging
                    ? (e) => {
                        e.stopPropagation();
                        pc.dropOnMood(m.uid);
                      }
                    : undefined
                }
              >
                <Card
                  card={db.get(m.card)}
                  mood={m}
                  value={m.currentValue}
                  highlighted={legal}
                  targetSelected={pc.moodSelected(m.uid)}
                  dimmed={dragging && !legal}
                  onClick={clickable ? () => pc.onMoodClick(m.uid) : undefined}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="zone">
        <h3 className="zone__label">
          Hand ({hand.length})
          {isActive && !pc.flow && (
            <button className="btn btn--pass" onClick={() => pc.onPass()}>
              Pass
            </button>
          )}
        </h3>

        {isActive && <ActiveHandControls pc={pc} state={state} />}

        <div className="zone__cards">
          {hand.length === 0 && <p className="muted">Empty hand.</p>}
          {hand.map((card, idx) => {
            const flowHandSlot = pc.flow != null && pc.currentSlot?.kind === 'handCard';
            const targetLegal = flowHandSlot && pc.handCardHighlighted(card);
            const interactive =
              isActive &&
              (pc.flow == null
                ? true
                : flowHandSlot && targetLegal); // during other slots, hand is inert
            return (
              <Card
                key={`${card}-${idx}`}
                card={db.get(card)}
                disabled={!interactive}
                selected={isActive && pc.isSelected(card)}
                highlighted={!!targetLegal}
                targetSelected={flowHandSlot && pc.handCardSelected(card)}
                draggable={isActive && pc.mode === 'drag' && pc.flow == null}
                onDragStart={() => pc.beginDrag(card)}
                onDragEnd={() => pc.endDrag()}
                onClick={interactive ? () => pc.onHandCardClick(card) : undefined}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Play button / selection prompt / extra-mood hint for the active player. */
function ActiveHandControls({ pc, state }: { pc: PlayController; state: GameState }) {
  const playedExtra = (state.playedThisTurn?.length ?? 0) > 0;

  if (pc.flow) return null; // the targeting bar takes over below

  return (
    <div className="handbar">
      {pc.selectedCard != null ? (
        <>
          <span className="handbar__label">
            Selected <strong>{db.get(pc.selectedCard).name}</strong>
          </span>
          <button className="btn btn--primary" onClick={() => pc.play()}>
            Play
          </button>
          <button className="btn" onClick={() => pc.selectCard(pc.selectedCard!)}>
            Clear
          </button>
        </>
      ) : playedExtra ? (
        <span className="handbar__hint ok">
          Extra mood granted — play another card or press <strong>Pass</strong> to end your turn.
        </span>
      ) : (
        <span className="handbar__hint muted">
          {pc.mode === 'manual' ? 'Click a card to select it, then press Play.' : 'Drag a card to the field or a target to play it.'}
        </span>
      )}
    </div>
  );
}

/** The guided slot-walking bar shown while a card is resolving its targets. */
function TargetingBar({ pc }: { pc: PlayController }) {
  if (!pc.flow || !pc.currentSlot) return null;
  const slot = pc.currentSlot;
  const cardName = db.get(pc.flow.card).name;
  const legal = pc.legalNow;

  return (
    <div className="targetbar" role="dialog" aria-label="Choose targets">
      <div className="targetbar__head">
        <span className="targetbar__card">{cardName}</span>
        <span className="targetbar__prompt">{pc.slotPrompt}</span>
        {pc.slotProgress && (
          <span className="targetbar__count">
            {pc.slotProgress.count}
            {pc.slotProgress.max > 1 ? ` / ${pc.slotProgress.max}` : ''}
            {pc.slotProgress.min > 0 ? ` (need ${pc.slotProgress.min})` : ''}
          </span>
        )}
      </div>

      {/* In-panel controls for non-board slots. Board slots (mood/player/handCard)
          are chosen by clicking the highlighted objects on the board. */}
      {slot.kind === 'color' && (
        <div className="targetbar__opts">
          {(legal?.colors ?? []).map((c) => (
            <button
              key={c}
              className={`chip chip--color ${pc.flow!.sel.colors.includes(c) ? 'is-on' : ''}`}
              onClick={() => pc.toggleColor(c)}
              style={{ borderColor: `var(--c-${c})` }}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      {slot.kind === 'number' && (
        <div className="targetbar__opts">
          {(legal?.numbers ?? []).map((n) => (
            <button
              key={n}
              className={`chip ${pc.flow!.sel.option === n ? 'is-on' : ''}`}
              onClick={() => pc.setOption(n)}
            >
              {n}
            </button>
          ))}
        </div>
      )}
      {slot.kind === 'choice' && (
        <div className="targetbar__opts">
          {(legal?.options ?? []).map((o) => (
            <button
              key={o}
              className={`chip ${pc.flow!.sel.option === o ? 'is-on' : ''}`}
              onClick={() => pc.setOption(o)}
            >
              {o}
            </button>
          ))}
        </div>
      )}
      {(slot.kind === 'mood' || slot.kind === 'player' || slot.kind === 'handCard') && (
        <p className="targetbar__hint muted">Click the highlighted {slot.kind === 'handCard' ? 'hand card' : slot.kind} target(s) above.</p>
      )}

      <div className="targetbar__actions">
        <button className="btn btn--primary" disabled={!pc.canConfirm} onClick={() => pc.confirm()}>
          Confirm
        </button>
        {pc.canSkip && (
          <button className="btn" onClick={() => pc.skip()}>
            Skip
          </button>
        )}
        <button className="btn" onClick={() => pc.cancel()}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function GameBoard({ state, onAction, onNewGame }: GameBoardProps) {
  const pc = usePlayInteraction(state, onAction);
  const active = state.players.find((p) => p.id === state.activePlayer);
  const gameOver = state.phase === 'gameOver';
  const winnerName = state.players.find((p) => p.id === state.winner)?.name;
  const dragging = pc.dragCard != null;

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
        {!gameOver && (
          <div className="mode-toggle" role="group" aria-label="Play mode">
            <span className="mode-toggle__lbl">Play mode</span>
            <button
              className={`tab ${pc.mode === 'manual' ? 'is-active' : ''}`}
              onClick={() => pc.setMode('manual')}
            >
              Click
            </button>
            <button
              className={`tab ${pc.mode === 'drag' ? 'is-active' : ''}`}
              onClick={() => pc.setMode('drag')}
            >
              Drag
            </button>
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

      {/* General "play field" drop zone — visible in drag mode. Dropping here
          plays with no specific target (immediate, or opens the flow at slot 0). */}
      {!gameOver && pc.mode === 'drag' && (
        <div
          className={`playfield ${dragging ? 'is-armed' : ''}`}
          onDragOver={dragging ? allowDrop : undefined}
          onDrop={dragging ? () => pc.dropOnField() : undefined}
        >
          {dragging ? 'Drop here to play (choose targets next)' : 'Drag a card here to play it'}
        </div>
      )}

      <div className="board__players">
        {state.players.map((p) => (
          <PlayerPanel key={p.id} player={p} state={state} pc={pc} />
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

      <TargetingBar pc={pc} />
    </div>
  );
}
