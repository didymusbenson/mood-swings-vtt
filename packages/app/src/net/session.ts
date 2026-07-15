// A Session is what <App> talks to instead of the engine directly. It hides the
// differences between the three play modes behind one small interface: give it
// actions, read a view, subscribe to changes. Goldfish and Host wrap a local
// MatchRunner; Join wraps a thin network client with no engine (see peer.ts).

import { Engine, type Action, type GameState, type PlayerId } from '@mood-swings/engine';
import { LocalHumanAgent, type PlayerAgent, type SeatView } from './agent.js';
import { MatchRunner } from './matchRunner.js';

export type SessionMode = 'goldfish' | 'host' | 'join';
export type SessionStatus = 'connecting' | 'active' | 'lost' | 'ended';

export interface Session {
  readonly mode: SessionMode;
  /**
   * The seat whose turn-controls THIS client drives. For Goldfish this is the
   * active seat (one driver plays whoever's turn it is); for Host it is the host's
   * fixed seat; for Join it is the seat the host assigned.
   */
  readonly localSeat: PlayerId;
  /** The seat pinned to the bottom of the table for this client (orientation). */
  readonly viewerSeat: PlayerId;
  /** Current view to render, or null before the first view has arrived. */
  readonly view: GameState | null;
  readonly status: SessionStatus;
  readonly error: string | null;
  /** Room code for host/join display + sharing; null for Goldfish. */
  readonly roomCode: string | null;
  /** Submit a play/pass for the local seat. */
  submit(action: Action): void;
  /** Subscribe to view/status/error changes. Returns an unsubscribe fn. */
  subscribe(listener: () => void): () => void;
  clearError(): void;
  /** Tear down transport / listeners. Idempotent. */
  teardown(): void;
}

/** Shared listener plumbing for the concrete sessions. */
export abstract class BaseSession implements Session {
  abstract readonly mode: SessionMode;
  abstract get localSeat(): PlayerId;
  abstract get viewerSeat(): PlayerId;

  protected _view: GameState | null = null;
  protected _status: SessionStatus = 'active';
  protected _error: string | null = null;
  protected _roomCode: string | null = null;
  private readonly listeners = new Set<() => void>();

  get view(): GameState | null {
    return this._view;
  }
  get status(): SessionStatus {
    return this._status;
  }
  get error(): string | null {
    return this._error;
  }
  get roomCode(): string | null {
    return this._roomCode;
  }

  abstract submit(action: Action): void;

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  clearError(): void {
    if (this._error !== null) {
      this._error = null;
      this.emit();
    }
  }
  protected emit(): void {
    for (const l of this.listeners) l();
  }
  teardown(): void {
    this.listeners.clear();
  }
}

/**
 * Goldfish: today's hotseat, re-parented under the runner with NO rules change.
 * One MatchRunner, redaction OFF, two LocalHumanAgents both feeding this one UI —
 * so both hands are visible and the single driver plays whoever's turn it is.
 * `localSeat` tracks the active player, exactly reproducing the old
 * `me = state.activePlayer` behaviour.
 */
export class GoldfishSession extends BaseSession {
  readonly mode = 'goldfish' as const;
  private readonly runner: MatchRunner;
  private readonly _viewerSeat: PlayerId;

  constructor(engine: Engine, initial: GameState) {
    super();
    this._viewerSeat = initial.players[0]!.id;
    // redact === false, so every agent receives the same full state; a single sink
    // captures it (last write wins — the views are identical).
    const sink = (v: SeatView) => {
      this._view = v.state;
      this.emit();
    };
    const agents: Record<PlayerId, PlayerAgent> = {};
    for (const p of initial.players) agents[p.id] = new LocalHumanAgent(p.id, sink);
    this.runner = new MatchRunner({
      engine,
      initial,
      agents,
      redact: false,
      onError: (msg) => {
        this._error = msg;
        this.emit();
      },
    });
    this._view = this.runner.current;
  }

  /** One driver controls whoever's turn it is. */
  get localSeat(): PlayerId {
    return (this._view ?? this.runner.current).activePlayer;
  }
  get viewerSeat(): PlayerId {
    return this._viewerSeat;
  }
  submit(action: Action): void {
    this.runner.submit(action);
  }
}
