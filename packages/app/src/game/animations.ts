// The animation event stream.
//
// Animations are driven off the engine's append-only `log` plus the structured
// view fields (`round`, `phase`, `winner`) — NOT off diffing arbitrary React
// state. That is deliberate and load-bearing for v2: a networked client receives
// exactly these same values in its (redacted) server view, so the cinematics
// derived here port to v2 unchanged. The only slice that does NOT port — animating
// an *opponent's* hidden card between zones — is intentionally out of scope here
// (it needs the redacted event stream v2 introduces).
//
// `deriveCinematics` is a pure function of (previous state, next state): given the
// log entries appended by the transition, it returns the ordered list of
// full-screen cues to play. Keeping it pure makes it unit-testable and keeps the
// hook (useGameEvents) a thin queue around it.

import type { GameState, LogEntry, ScoreBreakdown } from '@mood-swings/engine';

/** A blocking, full-screen cinematic cue. Played one at a time, in order. */
export type Cue =
  | { kind: 'roundStart'; round: number; firstPlayerName: string }
  | { kind: 'roundEnd'; round: number; scores: ScoreBreakdown[]; winnerName: string | null }
  | { kind: 'gameOver'; winnerName: string };

/** A lightweight, non-blocking flash (e.g. a player passing). */
export interface PassFlash {
  name: string;
  /** Monotonic tag so repeated passes retrigger the transient. */
  seq: number;
}

function nameMap(state: GameState): (pid: string | undefined) => string {
  const names = new Map(state.players.map((p) => [p.id, p.name] as const));
  return (pid) => (pid ? names.get(pid) ?? pid : '');
}

/** The winner declared by a round-end `round` entry ("… wins round N …"). */
function roundWinEntry(entries: LogEntry[]): LogEntry | undefined {
  return entries.find((e) => e.kind === 'round' && e.actor != null && /wins round/i.test(e.message));
}

/**
 * The ordered cinematics a single state transition should enqueue.
 *
 * - Opening (prev = null): a `roundStart` intro for the current round.
 * - A scoring transition appends a `score` entry (+ a `round` winner entry, and on
 *   match point a `game` entry). That yields `roundEnd`, then either `gameOver`
 *   (match over) or `roundStart` for the freshly-begun next round.
 */
export function deriveCinematics(prev: GameState | null, next: GameState): Cue[] {
  const name = nameMap(next);
  const newEntries = next.log.slice(prev ? prev.log.length : 0);
  const cues: Cue[] = [];

  // Round end — a fresh score breakdown was logged this transition.
  const scoreEntry = newEntries.find((e) => e.kind === 'score' && e.scores);
  if (scoreEntry?.scores) {
    const win = roundWinEntry(newEntries);
    cues.push({
      kind: 'roundEnd',
      round: scoreEntry.round,
      scores: scoreEntry.scores,
      winnerName: win ? name(win.actor) : null,
    });
  }

  // Match over — a `game` entry was logged (or the phase flipped to gameOver).
  const gameEntry = newEntries.find((e) => e.kind === 'game');
  if (gameEntry || (next.phase === 'gameOver' && prev?.phase !== 'gameOver')) {
    cues.push({ kind: 'gameOver', winnerName: name(next.winner ?? gameEntry?.actor) });
    return cues; // No next round after the match ends.
  }

  // Round start — the opening intro, or the next round after scoring.
  const opening = prev === null;
  const advanced = prev !== null && next.round > prev.round;
  if ((opening || advanced) && next.phase !== 'gameOver') {
    cues.push({ kind: 'roundStart', round: next.round, firstPlayerName: name(next.firstPlayer) });
  }

  return cues;
}

/** The most recent `pass` this transition, if any (drives the transient flash). */
export function derivePassFlash(prev: GameState | null, next: GameState): string | null {
  const name = nameMap(next);
  const newEntries = next.log.slice(prev ? prev.log.length : 0);
  const passEntry = [...newEntries].reverse().find((e) => e.kind === 'pass');
  return passEntry ? name(passEntry.actor) : null;
}
