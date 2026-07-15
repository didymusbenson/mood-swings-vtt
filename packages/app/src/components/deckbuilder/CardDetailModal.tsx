import { useEffect } from 'react';
import type { CardData } from '@mood-swings/engine';
import { Card } from '../Card.js';
import { CardDetails } from './CardDetails.js';
import { QuantityControl } from './QuantityControl.js';

interface CardDetailModalProps {
  card: CardData;
  count: number;
  onAdd(): void;
  onSet(n: number): void;
  onSub(): void;
  onClose(): void;
}

/**
 * Full-detail modal for a single clicked card (no prev/next). Face + all printed
 * detail + full Rosewater notes + the add/quantity control. Closes on the X
 * button, a backdrop click, or Esc.
 */
export function CardDetailModal({ card, count, onAdd, onSet, onSub, onClose }: CardDetailModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dbx-modal__backdrop" onClick={onClose} role="presentation">
      <div
        className="dbx-modal"
        role="dialog"
        aria-modal="true"
        aria-label={card.name}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dbx-modal__head">
          <h3 className="dbx-modal__title">{card.name}</h3>
          <button type="button" className="dbx-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="dbx-modal__body">
          <div className="dbx-modal__face">
            <Card card={card} large showArt />
            <div className="dbx-modal__qty">
              <QuantityControl count={count} onAdd={onAdd} onSet={onSet} onSub={onSub} />
            </div>
          </div>
          <div className="dbx-modal__detail">
            <CardDetails card={card} />
          </div>
        </div>
      </div>
    </div>
  );
}
