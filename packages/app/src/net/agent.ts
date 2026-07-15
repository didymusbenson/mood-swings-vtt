// A "seat" abstraction that unifies every play mode over ONE engine.
//
// Every seat in a match is represented by a PlayerAgent: the thing that produces
// that seat's actions and receives that seat's view. The MatchRunner (matchRunner.ts)
// owns the engine and, on each state change, pushes a per-seat view to every agent
// and routes every agent's action back into the engine. The only thing that differs
// between Goldfish, Host, and (deferred) Vs-Computer is WHICH agents fill the seats:
//
//   Goldfish   — two LocalHumanAgents (one driver plays whoever's turn it is)
//   Host Game  — LocalHumanAgent (host seat) + RemoteHumanAgent (joiner, over WebRTC)
//   Vs Computer— LocalHumanAgent + ComputerAgent   (deferred — stub only, no brain)

import type { Action, GameState, PlayerId } from '@mood-swings/engine';

/** A projection of state for one viewer (already redacted, or full for Goldfish). */
export interface SeatView {
  seat: PlayerId;
  /** State as this seat may see it. Redacted for hidden-hand modes; full for Goldfish. */
  state: GameState;
  /** True when it is this seat's turn to act (their turn AND awaiting a play). */
  isLocalTurn: boolean;
}

/**
 * A seat's connection to the match. The runner calls `pushView` whenever a new
 * authoritative view exists for this seat, and sets `onAction` to its submit
 * function; the agent invokes `onAction` to play/pass.
 */
export interface PlayerAgent {
  readonly seat: PlayerId;
  readonly kind: 'localHuman' | 'remoteHuman' | 'computer';
  /** Runner → agent: a fresh view for this seat. */
  pushView(view: SeatView): void;
  /** Agent → runner: submit an action. Assigned by the runner at construction. */
  onAction: (action: Action) => void;
}

/**
 * A human sitting at this browser. `pushView` forwards the seat's view to the UI
 * via the supplied sink; `onAction` (set by the runner) submits to the engine.
 * Used for both Goldfish seats, the host's own seat, and the joiner's own seat.
 */
export class LocalHumanAgent implements PlayerAgent {
  readonly kind = 'localHuman' as const;
  onAction: (action: Action) => void = () => {};
  constructor(
    readonly seat: PlayerId,
    private readonly sink: (view: SeatView) => void,
  ) {}
  pushView(view: SeatView): void {
    this.sink(view);
  }
}

/**
 * DEFERRED (Vs Computer). Scaffolding only — no AI brain. The seat consumes the
 * same redacted SeatView a remote human would, which guarantees a future brain is
 * fair by construction (it physically cannot see the opponent's hand) and drops in
 * without touching the runner, transport, or UI: it would inspect `view.state` and
 * call `this.onAction(chosenAction)` from `pushView`. Do NOT wire a "Vs Computer"
 * menu button until a brain exists — a game started against this stub would stall
 * on its turn.
 */
export class ComputerAgent implements PlayerAgent {
  readonly kind = 'computer' as const;
  onAction: (action: Action) => void = () => {};
  constructor(readonly seat: PlayerId) {}
  pushView(view: SeatView): void {
    if (!view.isLocalTurn) return;
    throw new Error('ComputerAgent has no brain yet (Vs Computer is deferred)');
  }
}
