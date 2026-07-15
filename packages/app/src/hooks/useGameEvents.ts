import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '@mood-swings/engine';
import { deriveCinematics, derivePassFlash, type Cue, type PassFlash } from '../game/animations.js';

/**
 * Turns the engine's append-only log into an animation event stream (see
 * `game/animations.ts`). Each new `GameState` is diffed against the previous one
 * by the pure `deriveCinematics`; the resulting cues are queued and surfaced one
 * at a time as blocking full-screen cinematics, plus a transient pass flash.
 *
 * This hook is the seam a v2 client reuses: swap "new state arrives from
 * App.dispatch" for "redacted view arrives from the server" and the same cues
 * fall out — the derivation reads only fields present in a networked view.
 */
export function useGameEvents(state: GameState): {
  cue: Cue | null;
  dismiss: () => void;
  passFlash: PassFlash | null;
} {
  const prevRef = useRef<GameState | null>(null);
  const [queue, setQueue] = useState<Cue[]>([]);
  const [passFlash, setPassFlash] = useState<PassFlash | null>(null);
  const passSeq = useRef(0);

  useEffect(() => {
    // App swaps in a fresh state object per dispatch, so identity marks a real
    // transition; re-running the effect with the same object is a no-op (idempotent).
    if (prevRef.current === state) return;
    const prev = prevRef.current;
    prevRef.current = state;

    const cues = deriveCinematics(prev, state);
    if (cues.length) setQueue((q) => [...q, ...cues]);

    const passer = derivePassFlash(prev, state);
    if (passer) setPassFlash({ name: passer, seq: ++passSeq.current });
  }, [state]);

  const dismiss = useCallback(() => setQueue((q) => q.slice(1)), []);

  return { cue: queue[0] ?? null, dismiss, passFlash };
}
