// Client-side hand ordering. The engine owns which cards are in each hand;
// this hook owns the *display order* so players can drag-reorder their hand.
//
// On every new engine state we reconcile the stored order against the fresh
// hand (see reconcileHandOrder): kept cards hold their arrangement, drawn cards
// append, played/discarded cards drop — so the view never desyncs from
// `state.hands[pid]`.

import { useCallback, useEffect, useState } from 'react';
import type { GameState } from '@mood-swings/engine';
import { moveInArray, reconcileHandOrder } from '../game/handOrder.js';

export interface HandOrderApi {
  /** The player's hand in chosen display order (always a permutation of the engine hand). */
  orderedHand: (pid: string) => number[];
  /** Reorder a player's hand: move the card at `from` to display insertion point `to`. */
  reorder: (pid: string, from: number, to: number) => void;
}

export function useHandOrder(state: GameState): HandOrderApi {
  const [orders, setOrders] = useState<Record<string, number[]>>({});

  // Reconcile against every fresh engine state. Functional update so we always
  // fold into the latest chosen order (including a reorder that just happened).
  useEffect(() => {
    setOrders((prev) => {
      const next: Record<string, number[]> = {};
      for (const p of state.players) {
        next[p.id] = reconcileHandOrder(prev[p.id] ?? [], state.hands[p.id] ?? []);
      }
      return next;
    });
  }, [state]);

  const orderedHand = useCallback(
    (pid: string): number[] => {
      const hand = state.hands[pid] ?? [];
      // Before the reconcile effect runs (first render after a state swap),
      // derive the order on the fly so rendering never lags a frame.
      return reconcileHandOrder(orders[pid] ?? [], hand);
    },
    [orders, state],
  );

  const reorder = useCallback(
    (pid: string, from: number, to: number) => {
      setOrders((prev) => {
        // Base the move on the same displayed order the caller measured against.
        const basis = reconcileHandOrder(prev[pid] ?? [], state.hands[pid] ?? []);
        return { ...prev, [pid]: moveInArray(basis, from, to) };
      });
    },
    [state],
  );

  return { orderedHand, reorder };
}
