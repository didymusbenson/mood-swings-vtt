import type { CardData } from '@mood-swings/engine';
import { DiceValue } from '../Card.js';

/**
 * The printed-detail payload shown in both the detail modal and the
 * Visual + detail browser row: all printed fields plus the full Rosewater
 * notes. Printed values only — the builder has no board state.
 */
export function CardDetails({ card }: { card: CardData }) {
  return (
    <div className="dbx-details">
      <dl className="dbx-facts">
        <div>
          <dt>Color</dt>
          <dd className={`dbx-color dbx-color--${card.color}`}>{card.color}</dd>
        </div>
        <div>
          <dt>Value</dt>
          <dd className="dbx-diceline">
            <DiceValue value={card.value} dieColor={card.dieColor} className="dice--mini" />
            <span className="muted">({card.dieColor} die)</span>
          </dd>
        </div>
        {card.secondaryValue && (
          <div>
            <dt>Secondary</dt>
            <dd className="dbx-diceline">
              <DiceValue value={card.secondaryValue.value} dieColor={card.secondaryValue.dieColor} className="dice--mini" />
              <span className="muted">({card.secondaryValue.dieColor} die)</span>
            </dd>
          </div>
        )}
        <div>
          <dt>Rarity</dt>
          <dd className="dbx-rarity">{card.rarity}</dd>
        </div>
        <div>
          <dt>Number</dt>
          <dd>#{card.number}</dd>
        </div>
        {card.artist && (
          <div>
            <dt>Artist</dt>
            <dd>{card.artist}</dd>
          </div>
        )}
      </dl>

      {card.rulesText ? (
        <p className="dbx-rules">{card.rulesText}</p>
      ) : (
        <p className="dbx-rules dbx-rules--vanilla muted">No rules text.</p>
      )}

      {card.notes && card.notes.length > 0 && (
        <div className="dbx-notes">
          <h4 className="dbx-notes__label">Notes</h4>
          <ul className="dbx-notes__list">
            {card.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
