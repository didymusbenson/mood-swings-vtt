import type { ViewProps } from '../types.js';
import { QuantityControl } from '../QuantityControl.js';
import { useFacePreview } from '../useFacePreview.js';

/** Color-coded card names + add control. Lightest view. Hover shows the face. */
export function SimpleNamedList({ groups, counts, onAdd, onSet, onSub, onOpen }: ViewProps) {
  const { bind, node } = useFacePreview();
  return (
    <div className="dbx-simple">
      {groups.map((g) => (
        <section key={g.label} className="dbx-section">
          <h4 className="dbx-section__head">
            {g.label} <span className="muted">({g.count})</span>
          </h4>
          <ul className="dbx-simple__list">
            {g.cards.map((card) => {
              const count = counts.get(card.number) ?? 0;
              return (
                <li
                  key={card.number}
                  className={`dbx-simple__row dbx-swatchrow--${card.color}${count > 0 ? ' is-in-deck' : ''}`}
                  onClick={() => onOpen(card)}
                  {...bind(card)}
                >
                  <span className="dbx-swatch" aria-hidden />
                  <span className="dbx-simple__name">{card.name}</span>
                  <QuantityControl
                    count={count}
                    onAdd={() => onAdd(card.number)}
                    onSet={(n) => onSet(card.number, n)}
                    onSub={() => onSub(card.number)}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {node}
    </div>
  );
}
