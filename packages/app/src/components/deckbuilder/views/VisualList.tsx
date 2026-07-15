import type { ViewProps } from '../types.js';
import { Card } from '../../Card.js';
import { QuantityControl } from '../QuantityControl.js';

/** Grid of full card faces; each tile carries the add control + click-to-open. */
export function VisualList({ groups, counts, onAdd, onSet, onSub, onOpen }: ViewProps) {
  return (
    <div className="dbx-visual">
      {groups.map((g) => (
        <section key={g.label} className="dbx-section">
          <h4 className="dbx-section__head">
            {g.label} <span className="muted">({g.count})</span>
          </h4>
          <div className="dbx-visual__grid">
            {g.cards.map((card) => {
              const count = counts.get(card.number) ?? 0;
              return (
                <div
                  key={card.number}
                  className={`dbx-visual__tile${count > 0 ? ' is-in-deck' : ''}`}
                  onClick={() => onOpen(card)}
                >
                  <Card card={card} large showArt />
                  <div className="dbx-visual__qty">
                    <QuantityControl
                      count={count}
                      onAdd={() => onAdd(card.number)}
                      onSet={(n) => onSet(card.number, n)}
                      onSub={() => onSub(card.number)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
