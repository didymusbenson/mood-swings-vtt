// Owns the single authoritative engine + the apply loop for a match.
//
// Exactly one MatchRunner exists per match, and it lives in exactly one browser:
// the host's (or, for Goldfish, the only browser). It is the SOLE caller of
// engine.apply — every seat submits actions through it, it validates + applies via
// the engine, and it broadcasts a per-seat (optionally redacted) view to every
// agent. It is transport-agnostic: the wire only appears in the RemoteHumanAgent
// that represents a networked seat.

import { Engine, redactFor, type Action, type GameState, type PlayerId } from '@mood-swings/engine';
import type { PlayerAgent } from './agent.js';

export interface MatchRunnerOpts {
  engine: Engine;
  /** Initial state from engine.setup(...). */
  initial: GameState;
  /** One agent per seat. Keys are PlayerIds. */
  agents: Record<PlayerId, PlayerAgent>;
  /**
   * Redact per-seat views. On for hidden-hand modes (Host / Vs Computer); off for
   * Goldfish, where one driver is entitled to the whole board.
   */
  redact: boolean;
  /** Called when a submitted action is rejected by the engine (illegal / out of turn). */
  onError?: (message: string, action: Action) => void;
}

export class MatchRunner {
  private state: GameState;

  constructor(private readonly opts: MatchRunnerOpts) {
    this.state = opts.initial;
    for (const seat of Object.keys(opts.agents) as PlayerId[]) {
      opts.agents[seat]!.onAction = (a) => this.submit(a);
    }
    this.broadcast();
  }

  /** The current authoritative (unredacted) state. */
  get current(): GameState {
    return this.state;
  }

  /**
   * The sole entry to the engine. Applies the action host-authoritatively: the
   * engine re-validates that it is legal and that `action.player` is the active
   * player, so a spoofed action from a networked seat is rejected here. On success
   * the new state is broadcast to every seat; on rejection the state is unchanged
   * and `onError` fires. Returns whether the action was applied.
   */
  submit(action: Action): boolean {
    let next: GameState;
    try {
      next = this.opts.engine.apply(this.state, action);
    } catch (e) {
      this.opts.onError?.(e instanceof Error ? e.message : String(e), action);
      return false;
    }
    this.state = next;
    this.broadcast();
    return true;
  }

  private broadcast(): void {
    for (const seat of Object.keys(this.opts.agents) as PlayerId[]) {
      const view = this.opts.redact ? redactFor(this.state, seat) : this.state;
      this.opts.agents[seat]!.pushView({
        seat,
        state: view,
        isLocalTurn: this.state.activePlayer === seat && this.state.phase === 'awaitingPlay',
      });
    }
  }
}
