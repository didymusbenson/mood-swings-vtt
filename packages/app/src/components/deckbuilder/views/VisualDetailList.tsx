import type { ViewProps } from '../types.js';
import { Card } from '../../Card.js';
import { CardDetails } from '../CardDetails.js';
import { QuantityControl } from '../QuantityControl.js';

/**
 * A row per card: the card face on the left, the complete details (all printed
 * fields + full Rosewater notes) on the right. Rows may be tall; the notes
 * column grows. Clicking the card face opens the modal; the details are inline.
 */
export function VisualDetailList({ groups, counts, onAdd, onSet, onSub, onOpen }: ViewProps) {
  return (
    <div className="dbx-vdetail">
      {groups.map((g) => (
        <section key={g.label} className="dbx-section">
          <h4 className="dbx-section__head">
            {g.label} <span className="muted">({g.count})</span>
          </h4>
          <div className="dbx-vdetail__rows">
            {g.cards.map((card) => {
              const count = counts.get(card.number) ?? 0;
              return (
                <div key={card.number} className={`dbx-vdetail__row${count > 0 ? ' is-in-deck' : ''}`}>
                  <div className="dbx-vdetail__face" onClick={() => onOpen(card)}>
                    <Card card={card} large showArt />
                    <div className="dbx-vdetail__qty">
                      <QuantityControl
                        count={count}
                        onAdd={() => onAdd(card.number)}
                        onSet={(n) => onSet(card.number, n)}
                        onSub={() => onSub(card.number)}
                      />
                    </div>
                  </div>
                  <div className="dbx-vdetail__detail">
                    <h3 className="dbx-vdetail__name">{card.name}</h3>
                    <CardDetails card={card} />
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
