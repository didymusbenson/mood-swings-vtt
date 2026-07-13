// Hand-rolled pointer dragging (mouse + touch) for the hotseat board.
//
// Unlike native HTML5 DnD, a floating copy of the card physically follows the
// pointer and the original "pops out" of the hand (a placeholder holds its gap).
// Pulling a card out does NOT auto-play — the player can drag it back.
//
// Release logic (see the task spec):
//   - over the hand            -> reorder the hand, cancel any play intent
//   - over the play field      -> play (immediate, or open the flow at slot 0)
//   - over a valid mood/player -> play (single-target immediately, else open the
//                                 flow with that target pre-selected)
//   - elsewhere / invalid      -> snap back (no play)
//
// Drop targets are discovered from the live DOM via `elementFromPoint` + `data-*`
// attributes, so no library and no per-target React wiring is needed.

import { useCallback, useRef, useState } from 'react';
import type React from 'react';
import type { PlayController } from './usePlayInteraction.js';

/** Pixels the pointer must travel before a press becomes a drag (vs a tap). */
const DRAG_THRESHOLD = 5;

export type DragOver =
  | { kind: 'hand'; index: number }
  | { kind: 'field' }
  | { kind: 'mood'; uid: string; legal: boolean }
  | { kind: 'player'; pid: string; legal: boolean }
  | { kind: 'none' };

export interface HandDragState {
  card: number;
  fromIndex: number;
  x: number;
  y: number;
  over: DragOver;
  /** True once the press crossed the threshold and the card popped out. */
  active: boolean;
}

export interface HandDragApi {
  drag: HandDragState | null;
  /** Whether releasing right now would play (field or a valid target). */
  wouldPlay: boolean;
  onCardPointerDown: (e: React.PointerEvent, card: number, index: number) => void;
}

/** Nearest ancestor carrying a `data-drop` marker, and that marker. */
function dropElementAt(x: number, y: number): { el: HTMLElement; kind: string } | null {
  const hit = document.elementFromPoint(x, y);
  const el = hit ? (hit.closest('[data-drop]') as HTMLElement | null) : null;
  if (!el) return null;
  return { el, kind: el.getAttribute('data-drop') ?? '' };
}

/** Insertion index within a hand container based on the pointer's x position. */
function handInsertionIndex(container: HTMLElement, x: number): number {
  const items = Array.from(container.querySelectorAll('[data-hand-index]')) as HTMLElement[];
  for (let i = 0; i < items.length; i++) {
    const r = items[i]!.getBoundingClientRect();
    if (x < r.left + r.width / 2) return i;
  }
  return items.length;
}

export function useHandDrag(
  pc: PlayController,
  reorder: (from: number, to: number) => void,
): HandDragApi {
  const [drag, setDrag] = useState<HandDragState | null>(null);
  const dragRef = useRef<HandDragState | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const publish = useCallback((next: HandDragState | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  const onCardPointerDown = useCallback(
    (e: React.PointerEvent, card: number, index: number) => {
      // Only the active player, in drag mode, outside a targeting flow, may drag.
      if (pc.mode !== 'drag' || !pc.canAct || pc.flow != null) return;
      if (e.button != null && e.button !== 0) return; // primary button / touch only

      const start = { x: e.clientX, y: e.clientY };
      startRef.current = start;
      publish({ card, fromIndex: index, x: start.x, y: start.y, over: { kind: 'none' }, active: false });

      const resolveOver = (x: number, y: number): DragOver => {
        const found = dropElementAt(x, y);
        if (!found) return { kind: 'none' };
        switch (found.kind) {
          case 'hand':
            return { kind: 'hand', index: handInsertionIndex(found.el, x) };
          case 'field':
            return { kind: 'field' };
          case 'mood': {
            const uid = found.el.getAttribute('data-mood-uid') ?? '';
            return { kind: 'mood', uid, legal: pc.canDropMood(card, uid) };
          }
          case 'player': {
            const pid = found.el.getAttribute('data-player-id') ?? '';
            return { kind: 'player', pid, legal: pc.canDropPlayer(card, pid) };
          }
          default:
            return { kind: 'none' };
        }
      };

      const onMove = (ev: PointerEvent) => {
        const cur = dragRef.current;
        if (!cur) return;
        const x = ev.clientX;
        const y = ev.clientY;
        if (!cur.active) {
          const s = startRef.current!;
          if (Math.hypot(x - s.x, y - s.y) < DRAG_THRESHOLD) return; // still a tap
          pc.beginDrag(cur.card); // arm highlight affordances (sets dragCard)
        }
        publish({ ...cur, x, y, over: resolveOver(x, y), active: true });
        ev.preventDefault();
      };

      const finish = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
      };

      const onUp = () => {
        const cur = dragRef.current;
        finish();
        publish(null);
        if (!cur || !cur.active) {
          pc.endDrag();
          return;
        }
        const over = cur.over;
        switch (over.kind) {
          case 'hand':
            reorder(cur.fromIndex, over.index); // pure view reorder, no play
            pc.endDrag();
            break;
          case 'field':
            pc.playToField(cur.card);
            break;
          case 'mood':
            if (over.legal) pc.playToMood(cur.card, over.uid);
            else pc.endDrag(); // snap back
            break;
          case 'player':
            if (over.legal) pc.playToPlayer(cur.card, over.pid);
            else pc.endDrag(); // snap back
            break;
          default:
            pc.endDrag(); // released over nothing -> snap back
        }
      };

      const onCancel = () => {
        finish();
        publish(null);
        pc.endDrag();
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      e.preventDefault();
    },
    [pc, reorder, publish],
  );

  const wouldPlay =
    !!drag &&
    drag.active &&
    (drag.over.kind === 'field' ||
      (drag.over.kind === 'mood' && drag.over.legal) ||
      (drag.over.kind === 'player' && drag.over.legal));

  return { drag, wouldPlay, onCardPointerDown };
}
