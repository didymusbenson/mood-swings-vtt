import { useMemo, useState } from 'react';
import type React from 'react';
import type { Action, GameState, Mood, PlayerState } from '@mood-swings/engine';
import { ROUNDS_TO_WIN } from '@mood-swings/engine';
import { db } from '../game/db.js';
import { Card, CardBack, Die } from './Card.js';
import { PreviewPane, type PreviewTarget } from './PreviewPane.js';
import { ActivityLog } from './ActivityLog.js';
import { Starburst } from './Starburst.js';
import { usePlayInteraction, type PlayController } from '../hooks/usePlayInteraction.js';
import { useHandOrder } from '../hooks/useHandOrder.js';
import { useHandDrag, type HandDragApi } from '../hooks/useHandDrag.js';

interface GameBoardProps {
  state: GameState;
  onAction: (action: Action) => void;
  onNewGame: () => void;
}

type SeatVariant = 'active' | 'opponent';

/** Everything a seat needs beyond the raw player/state. */
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

/** Rounds-won shown as collected little dice (a first-to-N tracker). */
function RoundPips({ won }: { won: number }) {
  return (
    <span className="pips" title={`${won} / ${ROUNDS_TO_WIN} rounds`}>
      {Array.from({ length: ROUNDS_TO_WIN }, (_, i) =>
        i < won ? (
          <Die key={i} value={i + 1} dieColor="black" className="die--pip" />
        ) : (
          <span key={i} className="pip pip--ghost" aria-hidden />
        ),
      )}
    </span>
  );
}

/** CSS-var fan transform for a card at index `i` of `n` in a hand. */
function fanVars(i: number, n: number, active: boolean): React.CSSProperties {
  if (n <= 1) return { ['--rot']: '0deg', ['--ty']: '0px', ['--i']: String(i) } as React.CSSProperties;
  const mid = (n - 1) / 2;
  const step = active ? Math.min(6, 44 / n) : Math.min(3.5, 24 / n);
  const off = Math.abs(i - mid);
  const rot = (i - mid) * step;
  const ty = active ? off * off * 1.1 : off * 1.0;
  return {
    ['--rot']: `${rot.toFixed(2)}deg`,
    ['--ty']: `${ty.toFixed(1)}px`,
    ['--i']: String(i),
  } as React.CSSProperties;
}

function SeatHeader({ player, state, isActive }: { player: PlayerState; state: GameState; isActive: boolean }) {
  return (
    <header className="seat__head">
      <div className="seat__id">
        <h2 className="seat__name">{player.name}</h2>
        <RoundPips won={player.roundsWon} />
      </div>
      <div className="seat__score">
        <span className="seat__score-num">{liveScore(state, player.id)}</span>
        <span className="seat__score-lbl">score</span>
      </div>
      {isActive && <span className="turn-badge">Your turn</span>}
    </header>
  );
}

/** A player's moods laid out on the table (drop targets during a play). */
function MoodTableau({ player, state, ctx, variant }: { player: PlayerState; state: GameState; ctx: PanelCtx; variant: SeatVariant }) {
  const { pc, setPreview } = ctx;
  const pid = player.id;
  const moods: Mood[] = state.moods[pid] ?? [];
  const dragging = pc.dragCard != null;

  return (
    <div className={`tableau tableau--${variant}`}>
      <h3 className="zone__label">Moods in play ({moods.length})</h3>
      <div className="tableau__cards">
        {moods.length === 0 && <p className="muted tableau__empty">No moods yet.</p>}
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
  );
}

/** A player's hand, fanned in an arc. The active hand is the focal drag surface. */
function HandRow({ player, state, ctx, variant }: { player: PlayerState; state: GameState; ctx: PanelCtx; variant: SeatVariant }) {
  const { pc, handDrag, orderedHand, setPreview } = ctx;
  const pid = player.id;
  const isActive = state.activePlayer === pid && state.phase === 'awaitingPlay';
  const isMe = isActive && pid === pc.me;
  const order = orderedHand(pid);
  const active = variant === 'active';

  // Active drag pop-out state (only for the dragging player's own hand).
  const drag = handDrag.drag;
  const draggingHere = !!(drag?.active && isMe);
  const draggingFrom = draggingHere ? drag!.fromIndex : null;
  const insertion = draggingHere && drag!.over.kind === 'hand' ? drag!.over.index : null;

  // Both play modes are always available: outside a targeting flow, a card can be
  // tapped to select (manual) or dragged to play/reorder.
  const canDragHand = isMe && pc.flow == null;

  const handChildren: React.ReactNode[] = [];
  order.forEach((card, idx) => {
    if (insertion === idx) {
      handChildren.push(<span key={`ins-${idx}`} className="hand__insert" aria-hidden />);
    }
    if (idx === draggingFrom) {
      handChildren.push(
        <div key={`ph-${idx}`} className="hand__slot hand__placeholder" data-hand-index={idx} style={fanVars(idx, order.length, active)} aria-hidden />,
      );
      return;
    }
    const flowHandSlot = pc.flow != null && pc.currentSlot?.kind === 'handCard';
    const targetLegal = flowHandSlot && pc.handCardHighlighted(card);
    const interactive = isActive && (pc.flow == null ? true : flowHandSlot && targetLegal);
    // During a targeting flow, hand cards are clicked to pick handCard targets.
    // Outside a flow, tap-to-select is handled by the drag hook's pointer-up, so
    // no onClick here (avoids a double select-then-play).
    const clickable = interactive && pc.flow != null;
    handChildren.push(
      <div key={`${card}-${idx}`} className="hand__slot" data-hand-index={idx} style={fanVars(idx, order.length, active)}>
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
    <div className={`hand hand--${variant}`}>
      <h3 className="zone__label">
        Hand ({order.length})
        {isActive && !pc.flow && (
          <button className="btn btn--pass" onClick={() => pc.onPass()}>
            Pass
          </button>
        )}
      </h3>

      {isActive && <ActiveHandControls pc={pc} state={state} />}

      <div className="hand__scroll">
        <div
          className={`hand__cards ${draggingHere ? 'is-dragging' : ''}`}
          data-drop={isMe && pc.flow == null ? 'hand' : undefined}
          data-hand-owner={pid}
        >
          {order.length === 0 && <p className="muted">Empty hand.</p>}
          {handChildren}
        </div>
      </div>
    </div>
  );
}

/** A whole seat: header, mood tableau, and (for the opponent) their hand. */
function Seat({ player, state, ctx, variant }: { player: PlayerState; state: GameState; ctx: PanelCtx; variant: SeatVariant }) {
  const { pc } = ctx;
  const pid = player.id;
  const isActive = state.activePlayer === pid && state.phase === 'awaitingPlay';
  const dragging = pc.dragCard != null;
  const playerIsLegal = pc.playerHighlighted(pid);
  const playerIsSelected = pc.playerSelected(pid);

  const classes = [
    'seat',
    `seat--${variant}`,
    isActive ? 'seat--turn' : '',
    playerIsLegal ? 'seat--target' : '',
    playerIsSelected ? 'seat--target-selected' : '',
    dragging && !playerIsLegal ? 'seat--dim' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={classes} data-drop="player" data-player-id={pid}>
      <SeatHeader player={player} state={state} isActive={isActive} />
      <MoodTableau player={player} state={state} ctx={ctx} variant={variant} />
      {variant === 'opponent' && <HandRow player={player} state={state} ctx={ctx} variant={variant} />}
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
          Tap a card to select it (then Play), or drag it onto the field or a target to play it. Drag within your hand to reorder.
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

/** The shared centre of the table: deck stack + discard fan + play-field drop. */
function PlayField({
  state,
  dragging,
  fieldOver,
  gameOver,
  setPreview,
}: {
  state: GameState;
  dragging: boolean;
  fieldOver: boolean;
  gameOver: boolean;
  setPreview: (t: PreviewTarget | null) => void;
}) {
  const discardTop = state.discard.slice(-8);
  const startIdx = state.discard.length - discardTop.length;

  return (
    <div className={`field ${dragging ? 'is-armed' : ''} ${fieldOver ? 'is-over' : ''}`} data-drop={gameOver ? undefined : 'field'}>
      <div className="field__pile field__deck">
        <div className="deck-stack" aria-hidden>
          {Array.from({ length: Math.min(4, Math.max(1, state.deck.length)) }, (_, i) => (
            <div key={i} className="deck-stack__card" style={{ ['--d']: String(i) } as React.CSSProperties}>
              <CardBack />
            </div>
          ))}
        </div>
        <span className="field__count">Deck · {state.deck.length}</span>
      </div>

      <div className="field__drop" aria-hidden={!dragging}>
        <span className="field__drop-msg">
          {dragging ? 'Release to play' : gameOver ? 'Game over' : 'Drag a card here to play'}
        </span>
      </div>

      <div className="field__pile field__discard">
        <div className="discard-fan">
          {discardTop.length === 0 && <span className="discard-fan__empty muted">empty</span>}
          {discardTop.map((n, i) => {
            const card = db.get(n);
            const total = discardTop.length;
            const rot = total > 1 ? (i - (total - 1) / 2) * 6 : 0;
            return (
              <button
                type="button"
                key={`${n}-${startIdx + i}`}
                className={`discard-card discard-card--${card.color}`}
                style={{ ['--rot']: `${rot}deg`, ['--i']: String(i) } as React.CSSProperties}
                onPointerEnter={() => setPreview({ card })}
                onFocus={() => setPreview({ card })}
                title={card.name}
              >
                <span className="discard-card__mono">{card.name.charAt(0)}</span>
              </button>
            );
          })}
        </div>
        <span className="field__count">Discard · {state.discard.length}</span>
      </div>
    </div>
  );
}

export function GameBoard({ state, onAction, onNewGame }: GameBoardProps) {
  const pc = usePlayInteraction(state, onAction);
  const { orderedHand, reorder } = useHandOrder(state);
  const handDrag = useHandDrag(pc, (from, to) => reorder(pc.me, from, to));
  const [preview, setPreview] = useState<PreviewTarget | null>(null);

  const gameOver = state.phase === 'gameOver';
  const winnerName = state.players.find((p) => p.id === state.winner)?.name;
  const dragging = pc.dragCard != null;

  // The active player sits at the bottom of the table; their opponent up top.
  const bottomPid = state.activePlayer ?? state.players[0]?.id;
  const bottom = state.players.find((p) => p.id === bottomPid) ?? state.players[0];
  const top = state.players.find((p) => p.id !== bottomPid) ?? state.players[1] ?? bottom;

  // While dragging, the preview always shows the dragged card.
  const previewTarget = useMemo<PreviewTarget | null>(
    () => (handDrag.drag?.active ? { card: db.get(handDrag.drag.card) } : preview),
    [handDrag.drag, preview],
  );

  const ctx: PanelCtx = { pc, handDrag, orderedHand, setPreview };
  const fieldOver = !!(handDrag.drag?.active && handDrag.drag.over.kind === 'field');

  return (
    <div className="table">
      <header className="table__banner">
        <div className="banner__title">
          <Starburst className="banner__burst" label={`Round ${state.round}`} />
          <div className="banner__meta">
            <strong className="banner__game">Mood Swings</strong>
            <span className="banner__phase">{state.phase}</span>
          </div>
        </div>
        {!gameOver && bottom && (
          <div className="banner__turn">
            Turn: <strong>{bottom.name}</strong>
          </div>
        )}
        {gameOver && (
          <div className="banner__gameover">
            <strong>{winnerName} wins the game!</strong>
            <button className="btn btn--primary" onClick={onNewGame}>
              New game
            </button>
          </div>
        )}
      </header>

      <PreviewPane target={previewTarget} />

      <main className="table__center">
        {top && <Seat player={top} state={state} ctx={ctx} variant="opponent" />}

        <PlayField state={state} dragging={dragging} fieldOver={fieldOver} gameOver={gameOver} setPreview={setPreview} />

        {bottom && (
          <>
            <Seat player={bottom} state={state} ctx={ctx} variant="active" />
            <div className="hand-dock">
              <HandRow player={bottom} state={state} ctx={ctx} variant="active" />
            </div>
          </>
        )}
      </main>

      <aside className="table__log">
        <ActivityLog log={state.log} />
      </aside>

      <TargetingBar pc={pc} />
      <DragGhost handDrag={handDrag} />
    </div>
  );
}
