import { useMemo, useState } from 'react';
import type React from 'react';
import type { Action, GameState, Mood, PlayerState } from '@mood-swings/engine';
import { ROUNDS_TO_WIN } from '@mood-swings/engine';
import { db } from '../game/db.js';
import { Card } from './Card.js';
import { PreviewPane, type PreviewTarget } from './PreviewPane.js';
import { ActivityLog } from './ActivityLog.js';
import { usePlayInteraction, type PlayController } from '../hooks/usePlayInteraction.js';
import { useHandOrder } from '../hooks/useHandOrder.js';
import { useHandDrag, type HandDragApi } from '../hooks/useHandDrag.js';

interface GameBoardProps {
  state: GameState;
  onAction: (action: Action) => void;
  onNewGame: () => void;
}

/** Everything a PlayerPanel needs beyond the raw player/state. */
interface PanelCtx {
  pc: PlayController;
  handDrag: HandDragApi;
  orderedHand: (pid: string) => number[];
  setPreview: (t: PreviewTarget | null) => void;
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

function PlayerPanel({ player, state, ctx }: { player: PlayerState; state: GameState; ctx: PanelCtx }) {
  const { pc, handDrag, orderedHand, setPreview } = ctx;
  const pid = player.id;
  const isActive = state.activePlayer === pid && state.phase === 'awaitingPlay';
  const isMe = isActive && pid === pc.me;
  const moods: Mood[] = state.moods[pid] ?? [];
  const order = orderedHand(pid);

  const dragging = pc.dragCard != null;
  const playerIsLegal = pc.playerHighlighted(pid);
  const playerIsSelected = pc.playerSelected(pid);

  // Active drag pop-out state (only for the dragging player's own hand).
  const drag = handDrag.drag;
  const draggingHere = !!(drag?.active && isMe);
  const draggingFrom = draggingHere ? drag!.fromIndex : null;
  const insertion = draggingHere && drag!.over.kind === 'hand' ? drag!.over.index : null;

  const canDragHand = isMe && pc.mode === 'drag' && pc.flow == null;

  const panelClasses = [
    'player',
    isActive ? 'player--active' : '',
    playerIsLegal ? 'player--target' : '',
    playerIsSelected ? 'player--target-selected' : '',
    dragging && !playerIsLegal ? 'player--dim' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handChildren: React.ReactNode[] = [];
  order.forEach((card, idx) => {
    if (insertion === idx) {
      handChildren.push(<span key={`ins-${idx}`} className="hand__insert" aria-hidden />);
    }
    if (idx === draggingFrom) {
      handChildren.push(<div key={`ph-${idx}`} className="hand__slot hand__placeholder" data-hand-index={idx} aria-hidden />);
      return;
    }
    const flowHandSlot = pc.flow != null && pc.currentSlot?.kind === 'handCard';
    const targetLegal = flowHandSlot && pc.handCardHighlighted(card);
    const interactive = isActive && (pc.flow == null ? true : flowHandSlot && targetLegal);
    // Click selects only in manual mode or when picking a hand-card flow target;
    // in drag mode the gesture is the drag itself.
    const clickable = interactive && (pc.flow != null || pc.mode === 'manual');
    handChildren.push(
      <div key={`${card}-${idx}`} className="hand__slot" data-hand-index={idx}>
        <Card
          card={db.get(card)}
          disabled={!interactive}
          selected={isActive && pc.isSelected(card)}
          highlighted={!!targetLegal}
          targetSelected={flowHandSlot && pc.handCardSelected(card)}
          pointerDraggable={canDragHand}
          onPointerDown={canDragHand ? (e) => handDrag.onCardPointerDown(e, card, idx) : undefined}
          onPointerEnter={() => setPreview({ card: db.get(card) })}
          onFocus={() => setPreview({ card: db.get(card) })}
          onClick={clickable ? () => pc.onHandCardClick(card) : undefined}
        />
      </div>,
    );
  });
  if (insertion === order.length) {
    handChildren.push(<span key="ins-end" className="hand__insert" aria-hidden />);
  }

  return (
    <section className={panelClasses} data-drop="player" data-player-id={pid}>
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
              <div key={m.uid} className="mood-drop" data-drop="mood" data-mood-uid={m.uid}>
                <Card
                  card={db.get(m.card)}
                  mood={m}
                  value={m.currentValue}
                  highlighted={legal}
                  targetSelected={pc.moodSelected(m.uid)}
                  dimmed={dragging && !legal}
                  onPointerEnter={() => setPreview({ card: db.get(m.card), mood: m, value: m.currentValue })}
                  onFocus={() => setPreview({ card: db.get(m.card), mood: m, value: m.currentValue })}
                  onClick={clickable ? () => pc.onMoodClick(m.uid) : undefined}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="zone">
        <h3 className="zone__label">
          Hand ({order.length})
          {isActive && !pc.flow && (
            <button className="btn btn--pass" onClick={() => pc.onPass()}>
              Pass
            </button>
          )}
        </h3>

        {isActive && <ActiveHandControls pc={pc} state={state} />}

        <div
          className={`zone__cards hand__cards ${draggingHere ? 'is-dragging' : ''}`}
          data-drop={isMe && pc.flow == null ? 'hand' : undefined}
          data-hand-owner={pid}
        >
          {order.length === 0 && <p className="muted">Empty hand.</p>}
          {handChildren}
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
          {pc.mode === 'manual'
            ? 'Click a card to select it, then press Play.'
            : 'Drag a card to the field or a target to play it — or drag within your hand to reorder.'}
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
        <p className="targetbar__hint muted">
          Click the highlighted {slot.kind === 'handCard' ? 'hand card' : slot.kind} target(s) above.
        </p>
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

/** The card that physically follows the pointer during a drag. */
function DragGhost({ handDrag }: { handDrag: HandDragApi }) {
  const drag = handDrag.drag;
  if (!drag?.active) return null;
  return (
    <div
      className={`drag-ghost ${handDrag.wouldPlay ? 'drag-ghost--armed' : ''}`}
      style={{ left: drag.x, top: drag.y }}
      aria-hidden
    >
      <Card card={db.get(drag.card)} />
    </div>
  );
}

export function GameBoard({ state, onAction, onNewGame }: GameBoardProps) {
  const pc = usePlayInteraction(state, onAction);
  const { orderedHand, reorder } = useHandOrder(state);
  const handDrag = useHandDrag(pc, (from, to) => reorder(pc.me, from, to));
  const [preview, setPreview] = useState<PreviewTarget | null>(null);

  const active = state.players.find((p) => p.id === state.activePlayer);
  const gameOver = state.phase === 'gameOver';
  const winnerName = state.players.find((p) => p.id === state.winner)?.name;
  const dragging = pc.dragCard != null;

  // While dragging, the preview always shows the dragged card.
  const previewTarget = useMemo<PreviewTarget | null>(
    () => (handDrag.drag?.active ? { card: db.get(handDrag.drag.card) } : preview),
    [handDrag.drag, preview],
  );

  const ctx: PanelCtx = { pc, handDrag, orderedHand, setPreview };
  const fieldOver = handDrag.drag?.active && handDrag.drag.over.kind === 'field';

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
            <button className={`tab ${pc.mode === 'manual' ? 'is-active' : ''}`} onClick={() => pc.setMode('manual')}>
              Click
            </button>
            <button className={`tab ${pc.mode === 'drag' ? 'is-active' : ''}`} onClick={() => pc.setMode('drag')}>
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

      <PreviewPane target={previewTarget} />

      <main className="board__center">
        {/* General "play field" drop zone (drag mode). Releasing here plays with
            no specific target (immediate, or opens the flow at slot 0). */}
        {!gameOver && pc.mode === 'drag' && (
          <div
            className={`playfield ${dragging ? 'is-armed' : ''} ${fieldOver ? 'is-over' : ''}`}
            data-drop="field"
          >
            {dragging ? 'Release here to play (choose targets next)' : 'Drag a card here to play it'}
          </div>
        )}

        <div className="board__players">
          {state.players.map((p) => (
            <PlayerPanel key={p.id} player={p} state={state} ctx={ctx} />
          ))}
        </div>

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
              <span
                key={`${n}-${i}`}
                className="discard__item"
                onPointerEnter={() => setPreview({ card: db.get(n) })}
              >
                {db.get(n).name}
              </span>
            ))}
          </div>
        </div>
      </main>

      <aside className="board__log">
        <ActivityLog log={state.log} />
      </aside>

      <TargetingBar pc={pc} />
      <DragGhost handDrag={handDrag} />
    </div>
  );
}
