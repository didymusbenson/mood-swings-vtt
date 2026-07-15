import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { Action, Color, GameState, Mood, PlayerState } from '@mood-swings/engine';
import { ROUNDS_TO_WIN, SELF_TARGET, type ChoiceSlot } from '@mood-swings/engine';
import { db } from '../game/db.js';
import { handWouldBe, moodComputed } from '../game/value.js';
import { assignAvatars } from '../game/avatars.js';
import { Card, CardBack, Die, DiceValue } from './Card.js';
import { PreviewPane, type PreviewTarget } from './PreviewPane.js';
import { ActivityLog } from './ActivityLog.js';
import { Starburst } from './Starburst.js';
import { RulesModal } from './RulesModal.js';
import { usePlayInteraction, type PlayController } from '../hooks/usePlayInteraction.js';
import { useHandOrder } from '../hooks/useHandOrder.js';
import { useHandDrag, type HandDragApi } from '../hooks/useHandDrag.js';

interface GameBoardProps {
  state: GameState;
  onAction: (action: Action) => void;
  onNewGame: () => void;
}

/** Fixed seat position on the table (F2 — never swaps by turn). */
type SeatPos = 'top' | 'bottom';

/** Everything a seat needs beyond the raw player/state. */
interface PanelCtx {
  pc: PlayController;
  handDrag: HandDragApi;
  orderedHand: (pid: string) => number[];
  /** Show a preview immediately (focus, programmatic). */
  setPreview: (t: PreviewTarget | null) => void;
  /**
   * Pointer-enter handler factory implementing the Preview open triggers: a mouse
   * hover opens the detailed preview only after >1s; a touch/pen tap opens it
   * instantly (mobile-friendly). Pair with `endHover` on pointer-leave.
   */
  hoverPreview: (t: PreviewTarget | null) => (e: React.PointerEvent) => void;
  /** Cancel a pending hover-open timer (pointer left before the delay elapsed). */
  endHover: () => void;
  avatars: Record<string, string>;
  openDiscard: () => void;
}

function liveScore(state: GameState, pid: string): number {
  const scored = state.roundScores[pid];
  if (scored !== undefined) return scored;
  return (state.moods[pid] ?? []).reduce((s, m) => s + m.currentValue, 0);
}

function isActiveSeat(state: GameState, pid: string): boolean {
  return state.activePlayer === pid && state.phase === 'awaitingPlay';
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

/**
 * CSS-var fan transform for a card at index `i` of `n` in a hand. `focal` is the
 * active player's larger, spread-out fan; `pos` flips the arc/tilt so a top seat
 * fans downward (F2 — each player plays from their own edge).
 */
function fanVars(i: number, n: number, focal: boolean, pos: SeatPos): React.CSSProperties {
  if (n <= 1) return { ['--rot']: '0deg', ['--ty']: '0px', ['--i']: String(i) } as React.CSSProperties;
  const mid = (n - 1) / 2;
  const step = focal ? Math.min(5, 36 / n) : Math.min(3.5, 24 / n);
  const off = Math.abs(i - mid);
  const dir = pos === 'top' ? -1 : 1;
  const rot = (i - mid) * step * dir;
  const ty = focal ? off * off * 0.7 : off * 1.0;
  return {
    ['--rot']: `${rot.toFixed(2)}deg`,
    ['--ty']: `${ty.toFixed(1)}px`,
    ['--i']: String(i),
  } as React.CSSProperties;
}

/** Seat identity header: avatar (F4a), name, round pips + a prominent score. */
function SeatHeader({
  player,
  state,
  isActive,
  avatar,
  pc,
  dragging,
}: {
  player: PlayerState;
  state: GameState;
  isActive: boolean;
  avatar: string;
  pc: PlayController;
  dragging: boolean;
}) {
  const pid = player.id;
  const legal = pc.playerHighlighted(pid);
  const selected = pc.playerSelected(pid);
  // The avatar carries the `data-drop="player"` contract (drag-to-player). Only
  // the avatar is the player target — the rest of the seat is field drop zone.
  const avatarClasses = [
    'seat__avatar',
    legal ? 'seat__avatar--target' : '',
    selected ? 'seat__avatar--selected' : '',
    dragging && !legal ? 'seat__avatar--dim' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <header className="seat__head">
      <span className={avatarClasses} data-drop="player" data-player-id={pid} aria-hidden>
        {avatar}
      </span>
      <div className="seat__id">
        <h2 className="seat__name">{player.name}</h2>
        <RoundPips won={player.roundsWon} />
      </div>
      {isActive && <span className="turn-badge">Your turn</span>}
      <div className="seat__score">
        <span className="seat__score-num">{liveScore(state, pid)}</span>
        <span className="seat__score-lbl">score</span>
      </div>
    </header>
  );
}

/** A player's moods laid out on the table (drop targets during a play). */
function MoodTableau({ player, state, ctx, pos }: { player: PlayerState; state: GameState; ctx: PanelCtx; pos: SeatPos }) {
  const { pc, setPreview } = ctx;
  const pid = player.id;
  const moods: Mood[] = state.moods[pid] ?? [];
  const dragging = pc.dragCard != null;

  return (
    <div className={`tableau tableau--${pos}`}>
      <div className="tableau__cards">
        {moods.length === 0 && <p className="muted tableau__empty">No moods in play yet.</p>}
        {moods.map((m) => {
          const legal = pc.moodHighlighted(m.uid);
          const clickable = legal && pc.dragCard == null; // clicking picks a flow target
          // A mood in play is always an actionable context → show its computed value.
          const preview: PreviewTarget = { card: db.get(m.card), mood: m, value: m.currentValue };
          return (
            <div key={m.uid} className="mood-drop" data-drop="mood" data-mood-uid={m.uid}>
              <Card
                card={db.get(m.card)}
                mood={m}
                value={m.currentValue}
                computed={moodComputed(m)}
                tile
                highlighted={legal}
                targetSelected={pc.moodSelected(m.uid)}
                dimmed={dragging && !legal}
                onPointerEnter={ctx.hoverPreview(preview)}
                onPointerLeave={ctx.endHover}
                onFocus={() => setPreview(preview)}
                onClick={clickable ? () => pc.onMoodClick(m.uid) : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A player's hand, fanned from their own edge. The active hand is the focal drag surface. */
function HandRow({ player, state, ctx, pos }: { player: PlayerState; state: GameState; ctx: PanelCtx; pos: SeatPos }) {
  const { pc, handDrag, orderedHand, setPreview } = ctx;
  const pid = player.id;
  const isActive = isActiveSeat(state, pid);
  const order = orderedHand(pid);

  // Active drag pop-out state (only for the active player's own hand; active === me).
  const drag = handDrag.drag;
  const draggingHere = !!(drag?.active && isActive);
  const draggingFrom = draggingHere ? drag!.fromIndex : null;
  const insertion = draggingHere && drag!.over.kind === 'hand' ? drag!.over.index : null;

  // Both play modes are always available: outside a targeting flow, a card can be
  // tapped to select (manual) or dragged to play/reorder.
  const canDragHand = isActive && pc.flow == null;

  const handChildren: React.ReactNode[] = [];
  order.forEach((card, idx) => {
    if (insertion === idx) {
      handChildren.push(<span key={`ins-${idx}`} className="hand__insert" aria-hidden />);
    }
    if (idx === draggingFrom) {
      handChildren.push(
        <div key={`ph-${idx}`} className="hand__slot hand__placeholder" data-hand-index={idx} style={fanVars(idx, order.length, isActive, pos)} aria-hidden />,
      );
      return;
    }
    const flowHandSlot = pc.flow != null && pc.currentSlot?.kind === 'handCard';
    const targetLegal = flowHandSlot && pc.handCardHighlighted(card);
    const interactive = isActive && (pc.flow == null ? true : flowHandSlot && targetLegal);
    // During a targeting flow, hand-card targets are surfaced in the overlay, so
    // here we only need tap-to-select (drag hook handles it) outside a flow.
    const clickable = interactive && pc.flow != null;
    // A playable hand card (the active player's, outside a flow) is actionable →
    // show its objective would-be value with the computed glow. Cards being read
    // (the idle opponent hand) keep their printed die.
    const playable = isActive && pc.flow == null;
    const wb = playable ? handWouldBe(state, pid, card) : null;
    const showWb = !!(wb && wb.objective && wb.value != null);
    const preview: PreviewTarget = { card: db.get(card), handOwner: playable ? pid : undefined };
    handChildren.push(
      <div key={`${card}-${idx}`} className="hand__slot" data-hand-index={idx} style={fanVars(idx, order.length, isActive, pos)}>
        <Card
          card={db.get(card)}
          tile
          value={showWb ? wb!.value! : undefined}
          computed={showWb && wb!.computed}
          disabled={!interactive}
          selected={isActive && pc.isSelected(card)}
          highlighted={!!targetLegal}
          targetSelected={flowHandSlot && pc.handCardSelected(card)}
          pointerDraggable={canDragHand}
          // Tap / click / drag all begin with pointer-down, so forcing the preview
          // here makes every one of them an immediate preview trigger (hover is the
          // fourth, delayed path). Disabled cards (opponent hands) emit no pointer
          // events, so hidden cards never leak through this.
          onPointerDown={
            interactive
              ? (e) => {
                  ctx.endHover();
                  setPreview(preview);
                  if (canDragHand) handDrag.onCardPointerDown(e, card, idx);
                }
              : undefined
          }
          onPointerEnter={ctx.hoverPreview(preview)}
          onPointerLeave={ctx.endHover}
          onFocus={() => setPreview(preview)}
          onClick={clickable ? () => pc.onHandCardClick(card) : undefined}
        />
      </div>,
    );
  });
  if (insertion === order.length) {
    handChildren.push(<span key="ins-end" className="hand__insert" aria-hidden />);
  }

  const focal = isActive ? 'hand--focal' : 'hand--idle';

  return (
    <div className={`hand hand--${pos} ${focal}`}>
      <div className="hand__scroll">
        <div
          className={`hand__cards ${draggingHere ? 'is-dragging' : ''}`}
          data-drop={canDragHand ? 'hand' : undefined}
          data-hand-owner={pid}
        >
          {order.length === 0 && <p className="muted">Empty hand.</p>}
          {handChildren}
        </div>
      </div>
    </div>
  );
}

/**
 * The dedicated action slot that sits ABOVE the hand, off to the right (never on
 * top of the cards). Home for every confirm/submit control:
 *   - outside a flow: Pass, and (when a card is tapped) Play / Clear.
 *   - during a flow:  Submit / Skip / Cancel for the modal targeting overlay.
 */
function ActionSlot({ pc, state }: { pc: PlayController; state: GameState }) {
  // During a targeting flow, the modal overlay owns the Submit/Skip/Cancel controls
  // (they're part of the overlay, above the scrim) — the action slot stays out of it.
  if (pc.flow) {
    return <div className="actionslot actionslot--empty" aria-hidden />;
  }

  const playedExtra = (state.playedThisTurn?.length ?? 0) > 0;
  return (
    <div className="actionslot">
      {pc.selectedCard != null ? (
        <>
          <span className="actionslot__label">
            <strong>{db.get(pc.selectedCard).name}</strong> selected
          </span>
          <button className="btn btn--primary" onClick={() => pc.play()}>
            Play
          </button>
          <button className="btn" onClick={() => pc.selectCard(pc.selectedCard!)}>
            Clear
          </button>
        </>
      ) : (
        <span className={`actionslot__hint ${playedExtra ? 'ok' : 'muted'}`}>
          {playedExtra ? 'Extra mood granted — play another or Pass.' : 'Tap or drag a card to play.'}
        </span>
      )}
      <button className="btn btn--pass" onClick={() => pc.onPass()}>
        Pass
      </button>
    </div>
  );
}

/**
 * A player's EDGE band — their info bar, action slot, and hand — pinned to the
 * outside of the play area (opponent at the very top, you at the very bottom). The
 * hand hugs the battlefield; the info bar sits at the outer edge; the action slot
 * sits just above the hand (F4a). The played moods are NOT here — they live in the
 * shared battlefield in the middle.
 */
function PlayerEdge({ player, state, ctx, pos }: { player: PlayerState; state: GameState; ctx: PanelCtx; pos: SeatPos }) {
  const { pc, avatars } = ctx;
  const pid = player.id;
  const isActive = isActiveSeat(state, pid);
  const dragging = pc.dragCard != null;

  const classes = [
    'edge',
    `edge--${pos}`,
    isActive ? 'edge--turn' : '',
    isActive && pc.flow ? 'edge--acting' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const header = <SeatHeader player={player} state={state} isActive={isActive} avatar={avatars[pid] ?? '🙂'} pc={pc} dragging={dragging} />;
  const actions = isActive ? <ActionSlot pc={pc} state={state} /> : <div className="actionslot actionslot--empty" aria-hidden />;
  const hand = <HandRow player={player} state={state} ctx={ctx} pos={pos} />;

  // Both edges stack header → action slot → hand outward from the battlefield, so the
  // hand is always the band nearest the player's screen edge. For the bottom seat that
  // means your oversized hand reads large and its bottom bleeds off the screen edge
  // (MTG-Arena / Slay-the-Spire style) rather than over your own info bar.
  return (
    <div className={classes}>
      {header}
      {actions}
      {hand}
    </div>
  );
}

/** Deck stack + discard pile column at the battlefield's left edge (F3). */
function PileColumn({ state, ctx }: { state: GameState; ctx: PanelCtx }) {
  const { openDiscard } = ctx;
  const top = state.discard[state.discard.length - 1];
  return (
    <div className="bf__pile">
      <div className="pile pile--deck">
        <div className="deck-stack" aria-hidden>
          {Array.from({ length: Math.min(4, Math.max(1, state.deck.length)) }, (_, i) => (
            <div key={i} className="deck-stack__card" style={{ ['--d']: String(i) } as React.CSSProperties}>
              <CardBack />
            </div>
          ))}
        </div>
        <span className="pile__count">Deck · {state.deck.length}</span>
      </div>

      <button
        type="button"
        className="pile pile--discard"
        onClick={openDiscard}
        disabled={state.discard.length === 0}
        title="Inspect the discard pile"
        onPointerEnter={(e) => { if (top != null) ctx.hoverPreview({ card: db.get(top), readOnly: true })(e); }}
        onPointerLeave={ctx.endHover}
      >
        <div className="pile__discard-top">
          {top == null ? (
            <span className="pile__empty muted">empty</span>
          ) : (
            <span className={`discard-card discard-card--${db.get(top).color}`}>
              <span className="discard-card__mono">{db.get(top).name.charAt(0)}</span>
            </span>
          )}
        </div>
        <span className="pile__count">Discard · {state.discard.length}</span>
      </button>
    </div>
  );
}

/**
 * The unified battlefield (F5): a SINGLE play zone holding only the played moods,
 * split into two halves by owner ("facing the player who played it") — the opponent's
 * moods in the top half, yours in the bottom half — with the deck+discard column at
 * the left edge. No per-player boxes; the whole area is the drop zone. Hands and info
 * live in the edge bands above/below, not here.
 */
function Battlefield({
  state,
  ctx,
  top,
  bottom,
  dragging,
  fieldOver,
  gameOver,
}: {
  state: GameState;
  ctx: PanelCtx;
  top: PlayerState;
  bottom: PlayerState;
  dragging: boolean;
  fieldOver: boolean;
  gameOver: boolean;
}) {
  const topTurn = !gameOver && isActiveSeat(state, top.id);
  const botTurn = !gameOver && isActiveSeat(state, bottom.id);
  return (
    <main
      className={`battlefield ${dragging ? 'is-armed' : ''} ${fieldOver ? 'is-over' : ''}`}
      data-drop={gameOver || ctx.pc.flow ? undefined : 'field'}
    >
      <PileColumn state={state} ctx={ctx} />
      <div className={`bf__half bf__half--top ${topTurn ? 'is-turn' : ''}`}>
        <MoodTableau player={top} state={state} ctx={ctx} pos="top" />
      </div>
      <div className="bf__center">
        <span className="bf__drop-msg">
          {dragging ? 'Release to play' : gameOver ? 'Game over' : 'Drop a card anywhere here to play'}
        </span>
      </div>
      <div className={`bf__half bf__half--bottom ${botTurn ? 'is-turn' : ''}`}>
        <MoodTableau player={bottom} state={state} ctx={ctx} pos="bottom" />
      </div>
    </main>
  );
}

// --- Modal targeting overlay (F4) ----------------------------------------

const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five'];
function numWord(n: number): string {
  return NUM_WORDS[n] ?? String(n);
}

function slotNoun(slot: ChoiceSlot, plural: boolean): string {
  switch (slot.kind) {
    case 'mood':
      return plural ? 'moods in play' : 'a mood in play';
    case 'player':
      return plural ? 'players' : 'a player';
    case 'handCard':
      return plural ? 'cards from your hand' : 'a card from your hand';
    case 'color':
      return plural ? 'colors' : 'a color';
    case 'number':
      return plural ? 'numbers' : 'a number';
    case 'choice':
      return plural ? 'options' : 'an option';
    case 'copy':
      return plural ? 'moods to copy' : 'a mood to copy';
  }
}

/** Big header wording derived from the current slot's kind + min/max (F4). */
function chooseHeading(slot: ChoiceSlot): string {
  if (slot.max <= 1) return `Choose ${slotNoun(slot, false)}`;
  if (slot.min === slot.max) return `Choose ${numWord(slot.min)} ${slotNoun(slot, true)}`;
  return `Choose up to ${numWord(slot.max)} ${slotNoun(slot, true)}`;
}

/** Find a mood object (and its owner) by uid, across all seats. */
function findMood(state: GameState, uid: string): { mood: Mood; owner: string } | null {
  for (const p of state.players) {
    const m = (state.moods[p.id] ?? []).find((x) => x.uid === uid);
    if (m) return { mood: m, owner: p.id };
  }
  return null;
}

function TargetOverlay({ pc, state, ctx }: { pc: PlayController; state: GameState; ctx: PanelCtx }) {
  const slot = pc.currentSlot;

  // Esc cancels the whole play.
  useEffect(() => {
    if (!pc.flow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') pc.cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pc]);

  if (!pc.flow || !slot) return null;
  const legal = pc.legalNow;
  const sel = pc.flow.sel;

  // Pre-submit computed preview: the card being played, with its would-be value
  // updating live as targets/costs are chosen. Target-dependent cards (Creativity
  // copy / Wonder colour) resolve once their choice is made.
  const playedCard = db.get(pc.flow.card);
  const wb = handWouldBe(state, pc.me, pc.flow.card, {
    copy: sel.copy ?? undefined,
    wonderColor: (sel.colors[0] as Color | undefined),
  });
  const showValue = wb.objective && wb.value != null;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={chooseHeading(slot)}>
      <div className="overlay__scrim" />
      <div className="overlay__panel overlay__panel--playing">
        <aside className="overlay__playing">
          <span className="overlay__playing-label">Playing</span>
          <h3 className="overlay__playing-name">{playedCard.name}</h3>
          <Card card={playedCard} large showArt value={showValue ? wb.value! : undefined} computed={showValue && wb.computed} />
          {showValue ? (
            <p className="overlay__playing-value">
              <span>Computed value</span>
              <DiceValue value={wb.value!} dieColor={playedCard.dieColor} className="dice--mini" computed={wb.computed} />
            </p>
          ) : (
            <p className="overlay__playing-value muted">Value resolves once chosen.</p>
          )}
        </aside>
        <div className="overlay__main">
        <h2 className="overlay__title">{chooseHeading(slot)}</h2>
        {slot.label && <p className="overlay__sub">{slot.label}</p>}
        {pc.slotProgress && pc.slotProgress.max > 1 && (
          <p className="overlay__count">
            Selected {pc.slotProgress.count} / {pc.slotProgress.max}
            {pc.slotProgress.min > 0 ? ` (need at least ${pc.slotProgress.min})` : ''}
          </p>
        )}

        <div className={`overlay__targets overlay__targets--${slot.kind}`}>
          {slot.kind === 'player' &&
            (legal?.players ?? []).map((pid) => {
              const player = state.players.find((p) => p.id === pid);
              return (
                <button
                  key={pid}
                  type="button"
                  className={`avatar-pick ${pc.playerSelected(pid) ? 'is-on' : ''}`}
                  onClick={() => pc.onPlayerClick(pid)}
                >
                  <span className="avatar-pick__face" aria-hidden>
                    {ctx.avatars[pid] ?? '🙂'}
                  </span>
                  <span className="avatar-pick__name">{player?.name ?? pid}</span>
                  <span className="avatar-pick__score">{liveScore(state, pid)} pts</span>
                </button>
              );
            })}

          {(slot.kind === 'mood' || slot.kind === 'copy') && (
            <div className="target-fan">
              {(legal?.moods ?? []).length === 0 && <p className="muted">No valid moods.</p>}
              {(legal?.moods ?? []).map((uid) => {
                // The mood being played, offered to its own afterPlaying effect (Conviction).
                if (uid === SELF_TARGET) {
                  const selfCard = db.get(pc.flow!.card);
                  return (
                    <div key={uid} className="target-fan__item">
                      <span className="target-fan__owner">This mood</span>
                      <Card
                        card={selfCard}
                        value={showValue ? wb.value! : undefined}
                        computed={showValue && wb.computed}
                        tile
                        targetSelected={pc.moodSelected(uid)}
                        onClick={() => pc.onMoodClick(uid)}
                        onPointerEnter={() => ctx.setPreview({ card: selfCard, handOwner: pc.me })}
                      />
                    </div>
                  );
                }
                const found = findMood(state, uid);
                if (!found) return null;
                const owner = state.players.find((p) => p.id === found.owner);
                return (
                  <div key={uid} className="target-fan__item">
                    <span className="target-fan__owner">{owner?.name}</span>
                    <Card
                      card={db.get(found.mood.card)}
                      mood={found.mood}
                      value={found.mood.currentValue}
                      computed={moodComputed(found.mood)}
                      tile
                      targetSelected={pc.moodSelected(uid)}
                      onClick={() => pc.onMoodClick(uid)}
                      onPointerEnter={() => ctx.setPreview({ card: db.get(found.mood.card), mood: found.mood, value: found.mood.currentValue })}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {slot.kind === 'handCard' && (
            <div className="target-fan">
              {(legal?.cards ?? []).length === 0 && <p className="muted">No valid cards.</p>}
              {(legal?.cards ?? []).map((card, i) => (
                <div key={`${card}-${i}`} className="target-fan__item">
                  <Card
                    card={db.get(card)}
                    tile
                    targetSelected={pc.handCardSelected(card)}
                    onClick={() => pc.onHandCardClick(card)}
                    onPointerEnter={() => ctx.setPreview({ card: db.get(card) })}
                  />
                </div>
              ))}
            </div>
          )}

          {slot.kind === 'color' && (
            <div className="overlay__chips">
              {(legal?.colors ?? []).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`chip chip--color ${sel.colors.includes(c) ? 'is-on' : ''}`}
                  onClick={() => pc.toggleColor(c)}
                  style={{ borderColor: `var(--c-${c})` }}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {slot.kind === 'number' && (
            <div className="overlay__chips">
              {(legal?.numbers ?? []).map((n) => (
                <button key={n} type="button" className={`chip ${sel.option === n ? 'is-on' : ''}`} onClick={() => pc.setOption(n)}>
                  {n}
                </button>
              ))}
            </div>
          )}

          {slot.kind === 'choice' && (
            <div className="overlay__chips">
              {(legal?.options ?? []).map((o) => (
                <button key={o} type="button" className={`chip ${sel.option === o ? 'is-on' : ''}`} onClick={() => pc.setOption(o)}>
                  {o}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* The modal owns its own confirm controls (part of the overlay, above the
            scrim) — never the player-bar action slot, which the scrim covers. */}
        <div className="overlay__actions">
          <button className="btn btn--primary" disabled={!pc.canConfirm} onClick={() => pc.confirm()}>
            Submit
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
      </div>
    </div>
  );
}

/** Click-to-inspect discard viewer: the pile as a horizontal, scrollable fan (F3). */
function DiscardInspector({ state, onClose, setPreview }: { state: GameState; onClose: () => void; setPreview: (t: PreviewTarget | null) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="inspector" role="dialog" aria-modal="true" aria-label="Discard pile">
      <div className="overlay__scrim" onClick={onClose} />
      <div className="inspector__panel">
        <header className="inspector__head">
          <h2 className="inspector__title">Discard pile · {state.discard.length}</h2>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </header>
        {state.discard.length === 0 ? (
          <p className="muted">The discard pile is empty.</p>
        ) : (
          <div className="inspector__fan">
            {state.discard.map((n, i) => (
              <div key={`${n}-${i}`} className="inspector__item">
                <Card
                  card={db.get(n)}
                  tile
                  onPointerEnter={() => setPreview({ card: db.get(n) })}
                  onFocus={() => setPreview({ card: db.get(n) })}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** The card that physically follows the pointer during a drag. */
function DragGhost({ handDrag }: { handDrag: HandDragApi }) {
  const drag = handDrag.drag;
  if (!drag?.active) return null;
  return (
    <div className={`drag-ghost ${handDrag.wouldPlay ? 'drag-ghost--armed' : ''}`} style={{ left: drag.x, top: drag.y }} aria-hidden>
      <Card card={db.get(drag.card)} tile />
    </div>
  );
}

export function GameBoard({ state, onAction, onNewGame }: GameBoardProps) {
  const pc = usePlayInteraction(state, onAction);
  const { orderedHand, reorder } = useHandOrder(state);
  const handDrag = useHandDrag(pc, (from, to) => reorder(pc.me, from, to));
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  // Preview open triggers: mouse hover opens the detail panel only after >1s; a
  // touch/pen tap opens it instantly. `hoverPreview` returns the pointer handler;
  // `endHover` cancels a pending timer when the pointer leaves early.
  const hoverTimer = useRef<number | null>(null);
  const endHover = useCallback(() => {
    if (hoverTimer.current != null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }, []);
  const hoverPreview = useCallback(
    (t: PreviewTarget | null) => (e: React.PointerEvent) => {
      endHover();
      if (e.pointerType === 'mouse') {
        hoverTimer.current = window.setTimeout(() => setPreview(t), 1000);
      } else {
        setPreview(t); // touch / pen: instant (mobile-friendly)
      }
    },
    [endHover],
  );
  useEffect(() => endHover, [endHover]);

  const gameOver = state.phase === 'gameOver';
  const winnerName = state.players.find((p) => p.id === state.winner)?.name;
  const dragging = pc.dragCard != null;

  const avatars = useMemo(() => assignAvatars(state.players), [state.players]);

  // Fixed seats (F2): Player 1 permanently bottom, Player 2 permanently top.
  const bottom = state.players[0]!;
  const top = state.players[1] ?? bottom;

  // When a targeting flow opens, drop any stale hover-preview (and its pending
  // timer) so the pane starts on the card being played rather than whatever was
  // last hovered. Hovering a modal target then updates it live (below).
  const flowCard = pc.flow?.card ?? null;
  useEffect(() => {
    endHover();
    setPreview(null);
  }, [flowCard, endHover]);

  // The preview shows the dragged card; during targeting it holds the card being
  // played (F4 — in the Preview space) but switches to whatever modal target is
  // hovered so it stays a big, legible read; else whatever is hovered/focused.
  const previewTarget = useMemo<PreviewTarget | null>(() => {
    if (handDrag.drag?.active) return { card: db.get(handDrag.drag.card) };
    if (pc.flow) return preview ?? { card: db.get(pc.flow.card) };
    return preview;
  }, [handDrag.drag, pc.flow, preview]);

  const ctx: PanelCtx = { pc, handDrag, orderedHand, setPreview, hoverPreview, endHover, avatars, openDiscard: () => setDiscardOpen(true) };
  const fieldOver = !!(handDrag.drag?.active && handDrag.drag.over.kind === 'field');

  return (
    <div className="table">
      <header className="topbar">
        <div className="topbar__brand">
          <Starburst className="topbar__burst" label={`Round ${state.round}`} />
          <div className="topbar__meta">
            <strong className="topbar__game">Mood Swings</strong>
            <span className="topbar__phase">{gameOver ? 'game over' : state.phase}</span>
          </div>
        </div>

        <div className="topbar__scores">
          {state.players.map((p) => (
            <div
              key={p.id}
              className={['scoretag', !gameOver && isActiveSeat(state, p.id) ? 'is-turn' : ''].filter(Boolean).join(' ')}
            >
              <span className="scoretag__avatar" aria-hidden>
                {avatars[p.id] ?? '🙂'}
              </span>
              <span className="scoretag__name">{p.name}</span>
              <span className="scoretag__score">{liveScore(state, p.id)}</span>
              <RoundPips won={p.roundsWon} />
            </div>
          ))}
        </div>

        <div className="topbar__actions">
          {gameOver && <span className="topbar__winner">{winnerName} wins!</span>}
          <button
            className="btn btn--icon"
            onClick={() => setRulesOpen(true)}
            aria-label="How to play"
            title="How to play"
          >
            ?
          </button>
          <button className="btn btn--primary" onClick={onNewGame}>
            New game
          </button>
        </div>
      </header>

      <div className="board">
        <PreviewPane target={previewTarget} state={state} floating={!!pc.flow || discardOpen} />
        {/* Center column, three stacked bands (F5): opponent edge / battlefield / your edge. */}
        <div className="playfield">
          <PlayerEdge player={top} state={state} ctx={ctx} pos="top" />
          <Battlefield state={state} ctx={ctx} top={top} bottom={bottom} dragging={dragging} fieldOver={fieldOver} gameOver={gameOver} />
          <PlayerEdge player={bottom} state={state} ctx={ctx} pos="bottom" />
        </div>
        <ActivityLog log={state.log} />
      </div>

      <TargetOverlay pc={pc} state={state} ctx={ctx} />
      {discardOpen && <DiscardInspector state={state} onClose={() => setDiscardOpen(false)} setPreview={setPreview} />}
      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
      <DragGhost handDrag={handDrag} />
    </div>
  );
}
