import type React from 'react';
import type { CardData } from '@mood-swings/engine';
import { Card } from '../Card.js';

/**
 * A small floating card face shown on hover in the text-only browser views
 * (Simple / Detailed), where the card image isn't already on screen. Face only
 * — full detail lives in the click modal. Positioned near the pointer by `x`/`y`.
 */
export function CardFacePreview({ card, x, y }: { card: CardData; x: number; y: number }) {
  // Keep the floating card clear of the right/bottom edges.
  const style: React.CSSProperties = {
    left: Math.min(x + 16, (typeof window !== 'undefined' ? window.innerWidth : 1280) - 180),
    top: Math.min(y + 16, (typeof window !== 'undefined' ? window.innerHeight : 800) - 240),
  };
  return (
    <div className="dbx-facepreview" style={style} aria-hidden>
      <Card card={card} large showArt />
    </div>
  );
}
