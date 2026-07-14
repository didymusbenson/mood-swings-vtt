import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import type { CardData } from '@mood-swings/engine';
import { CardFacePreview } from './CardFacePreview.js';

/**
 * Hover-to-preview for the text-only browser views (Simple / Detailed). After a
 * mouse rests on a row for ~1s, a floating card face appears near the pointer.
 * Touch/pen are ignored (they use the tap-to-open modal instead). Returns a
 * `bind(card)` prop-spreader for each row and the `node` to render once.
 */
export function useFacePreview() {
  const [hover, setHover] = useState<{ card: CardData; x: number; y: number } | null>(null);
  const timer = useRef<number | null>(null);
  const pos = useRef({ x: 0, y: 0 });

  const clear = useCallback(() => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const bind = useCallback(
    (card: CardData) => ({
      onPointerMove: (e: React.PointerEvent) => {
        pos.current = { x: e.clientX, y: e.clientY };
      },
      onPointerEnter: (e: React.PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        pos.current = { x: e.clientX, y: e.clientY };
        clear();
        timer.current = window.setTimeout(
          () => setHover({ card, x: pos.current.x, y: pos.current.y }),
          1000,
        );
      },
      onPointerLeave: () => {
        clear();
        setHover(null);
      },
    }),
    [clear],
  );

  const node = hover ? <CardFacePreview card={hover.card} x={hover.x} y={hover.y} /> : null;
  return { bind, node };
}
