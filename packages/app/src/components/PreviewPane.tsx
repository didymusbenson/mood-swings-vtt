import type { CardData, Mood } from '@mood-swings/engine';
import { Card, DiceValue } from './Card.js';

export interface PreviewTarget {
  card: CardData;
  mood?: Mood;
  /** Live/computed value to headline (for moods in play). */
  value?: number;
}

/**
 * Fixed left-hand preview zone, styled as a taped index card / notebook page.
 * Shows whatever card is currently hovered, focused, selected, or being dragged
 * — large, with its full printed text. Keyboard-focusable so the pane itself is
 * reachable for accessibility.
 */
export function PreviewPane({ target }: { target: PreviewTarget | null }) {
  return (
    <aside className="preview" tabIndex={0} aria-label="Card preview">
      <span className="preview__tape preview__tape--l" aria-hidden />
      <span className="preview__tape preview__tape--r" aria-hidden />
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
              <dd className="preview__diceline">
                <DiceValue value={target.card.value} dieColor={target.card.dieColor} className="dice--mini" />
                <span className="muted">({target.card.dieColor} die)</span>
              </dd>
            </div>
            {target.card.secondaryValue && (
              <div>
                <dt>Secondary</dt>
                <dd className="preview__diceline">
                  <DiceValue value={target.card.secondaryValue.value} dieColor={target.card.secondaryValue.dieColor} className="dice--mini" />
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
