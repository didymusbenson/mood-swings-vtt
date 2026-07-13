import type { CardData, Mood } from '@mood-swings/engine';
import { Card } from './Card.js';

export interface PreviewTarget {
  card: CardData;
  mood?: Mood;
  /** Live/computed value to headline (for moods in play). */
  value?: number;
}

function dieLabel(v: number): string {
  if (v <= 6) return String(v);
  return `6+${v - 6}`;
}

/**
 * Fixed left-hand preview zone. Shows whatever card is currently hovered,
 * focused, selected, or being dragged — large, with its full printed text.
 * Keyboard-focusable so the pane itself is reachable for accessibility.
 */
export function PreviewPane({ target }: { target: PreviewTarget | null }) {
  return (
    <aside className="preview" tabIndex={0} aria-label="Card preview">
      <h3 className="preview__label">Preview</h3>
      {target ? (
        <div className="preview__body">
          <Card card={target.card} mood={target.mood} value={target.value} large showArt />
          <dl className="preview__facts">
            <div>
              <dt>Color</dt>
              <dd className={`preview__color preview__color--${target.card.color}`}>{target.card.color}</dd>
            </div>
            <div>
              <dt>Value</dt>
              <dd>
                {dieLabel(target.card.value)} <span className="muted">({target.card.dieColor} die)</span>
              </dd>
            </div>
            {target.card.secondaryValue && (
              <div>
                <dt>Secondary</dt>
                <dd>
                  {dieLabel(target.card.secondaryValue.value)}{' '}
                  <span className="muted">({target.card.secondaryValue.dieColor} die)</span>
                </dd>
              </div>
            )}
            <div>
              <dt>Rarity</dt>
              <dd className="preview__rarity">{target.card.rarity}</dd>
            </div>
          </dl>
          {target.card.rulesText && <p className="preview__rules">{target.card.rulesText}</p>}
        </div>
      ) : (
        <p className="preview__empty muted">Hover, focus, or drag a card to preview it here.</p>
      )}
    </aside>
  );
}
