// A Session is what <App> talks to instead of the engine directly. It hides the
// differences between the three play modes behind one small interface: give it
// actions, read a view, subscribe to changes. Goldfish and Host wrap a local
// MatchRunner; Join wraps a thin network client with no engine (see peer.ts).

import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { Engine, type Action, type GameState, type PlayerId } from '@mood-swings/engine';
import { LocalHumanAgent, type PlayerAgent, type SeatView } from './agent.js';
import { MatchRunner } from './matchRunner.js';
import {
  HOST_SEAT,
  JOINER_SEAT,
  RemoteHumanAgent,
  isValidInboundAction,
  normaliseCode,
  roomPeerId,
  type NetMsg,
} from './peer.js';

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

/**
 * Host Game (host side). Owns the engine via a MatchRunner with redaction ON. Seat
 * p1 is the host (LocalHumanAgent); seat p2 is the joiner (RemoteHumanAgent over the
 * DataConnection). The match does not begin until a joiner connects: until then the
 * session is `connecting` with a room code to share. Host-authoritative — the engine
 * re-validates every joiner action.
 */
export class HostSession extends BaseSession {
  readonly mode = 'host' as const;
  private readonly peer: Peer;
  private conn: DataConnection | null = null;
  private runner: MatchRunner | null = null;
  private remote: RemoteHumanAgent | null = null;

  constructor(
    private readonly engine: Engine,
    private readonly initial: GameState,
    code: string,
  ) {
    super();
    this._roomCode = normaliseCode(code);
    this._status = 'connecting';
    this.peer = new Peer(roomPeerId(code));
    this.peer.on('error', (err: { type?: string; message?: string }) => {
      this._error = `Connection error: ${err.type ?? err.message ?? 'unknown'}`;
      this._status = 'lost';
      this.emit();
    });
    this.peer.on('connection', (conn: DataConnection) => this.onConnection(conn));
  }

  get localSeat(): PlayerId {
    return HOST_SEAT;
  }
  get viewerSeat(): PlayerId {
    return HOST_SEAT;
  }

  private onConnection(conn: DataConnection): void {
    if (this.conn) {
      conn.close(); // one joiner only — reject extras
      return;
    }
    this.conn = conn;
    conn.on('open', () => this.startMatch(conn));
    conn.on('data', (d: unknown) => this.onData(d));
    conn.on('close', () => {
      this._status = 'lost';
      this._error = 'Opponent disconnected.';
      this.emit();
    });
    conn.on('error', () => {
      this._status = 'lost';
      this.emit();
    });
  }

  private startMatch(conn: DataConnection): void {
    conn.send({ t: 'hello', seat: JOINER_SEAT } satisfies NetMsg);
    const send = (msg: NetMsg) => conn.send(msg);
    this.remote = new RemoteHumanAgent(JOINER_SEAT, send);
    const localSink = (v: SeatView) => {
      this._view = v.state;
      this.emit();
    };
    const agents: Record<PlayerId, PlayerAgent> = {
      [HOST_SEAT]: new LocalHumanAgent(HOST_SEAT, localSink),
      [JOINER_SEAT]: this.remote,
    };
    this.runner = new MatchRunner({
      engine: this.engine,
      initial: this.initial,
      agents,
      redact: true,
      onError: (msg, action) => {
        // A rejected joiner action goes back to them; a rejected host action is local.
        if (action.player === JOINER_SEAT) conn.send({ t: 'error', message: msg } satisfies NetMsg);
        else {
          this._error = msg;
          this.emit();
        }
      },
    });
    this._status = 'active';
    this.emit(); // the runner already broadcast the first views via the sinks
  }

  private onData(d: unknown): void {
    const msg = d as NetMsg;
    if (msg?.t === 'action') {
      if (!isValidInboundAction(msg.action)) return;
      // A joiner may only ever act as their own seat; the engine also re-checks turn.
      if (msg.action.player !== JOINER_SEAT) {
        this.conn?.send({ t: 'error', message: 'You can only play your own seat.' } satisfies NetMsg);
        return;
      }
      this.remote?.onAction(msg.action);
    }
  }

  submit(action: Action): void {
    this.runner?.submit(action);
  }

  override teardown(): void {
    super.teardown();
    try {
      this.conn?.close();
      this.peer.destroy();
    } catch {
      /* already torn down */
    }
  }
}

/**
 * Host Game (joiner side). A thin client with NO engine: it opens a DataConnection to
 * the host's room, receives its seat via `hello` and redacted views via `state`, and
 * sends its plays as `action`. Rendering is driven directly by the incoming views.
 */
export class JoinSession extends BaseSession {
  readonly mode = 'join' as const;
  private readonly peer: Peer;
  private conn: DataConnection | null = null;
  private _localSeat: PlayerId = JOINER_SEAT;

  constructor(code: string) {
    super();
    this._roomCode = normaliseCode(code);
    this._status = 'connecting';
    this.peer = new Peer();
    this.peer.on('open', () => {
      const conn = this.peer.connect(roomPeerId(code), { serialization: 'json', reliable: true });
      this.conn = conn;
      conn.on('data', (d: unknown) => this.onData(d));
      conn.on('close', () => {
        this._status = 'lost';
        this._error = 'Disconnected from host.';
        this.emit();
      });
      conn.on('error', () => {
        this._status = 'lost';
        this.emit();
      });
    });
    this.peer.on('error', (err: { type?: string }) => {
      this._error =
        err.type === 'peer-unavailable'
          ? 'No game found for that code. Check it and try again.'
          : `Connection error: ${err.type ?? 'unknown'}`;
      this._status = 'lost';
      this.emit();
    });
  }

  get localSeat(): PlayerId {
    return this._localSeat;
  }
  get viewerSeat(): PlayerId {
    return this._localSeat;
  }

  private onData(d: unknown): void {
    const msg = d as NetMsg;
    switch (msg?.t) {
      case 'hello':
        this._localSeat = msg.seat;
        this.emit();
        break;
      case 'state':
        this._view = msg.view;
        this._status = 'active';
        this.emit();
        break;
      case 'error':
        this._error = msg.message;
        this.emit();
        break;
    }
  }

  submit(action: Action): void {
    this.conn?.send({ t: 'action', action } satisfies NetMsg);
  }

  override teardown(): void {
    super.teardown();
    try {
      this.conn?.close();
      this.peer.destroy();
    } catch {
      /* already torn down */
    }
  }
}
