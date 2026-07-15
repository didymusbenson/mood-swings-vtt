import type { ViewProps } from '../types.js';
import { DiceValue } from '../../Card.js';
import { QuantityControl } from '../QuantityControl.js';
import { useFacePreview } from '../useFacePreview.js';

function snippet(text: string | null): string {
  if (!text) return '—';
  return text.length > 90 ? `${text.slice(0, 88)}…` : text;
}

/** Dense table: Name · Color · Value · Secondary · Rarity · rules snippet + add. */
export function DetailedList({ groups, counts, onAdd, onSet, onSub, onOpen }: ViewProps) {
  const { bind, node } = useFacePreview();
  return (
    <div className="dbx-detailed">
      {groups.map((g) => (
        <section key={g.label} className="dbx-section">
          <h4 className="dbx-section__head">
            {g.label} <span className="muted">({g.count})</span>
          </h4>
          <table className="dbx-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Color</th>
                <th>Value</th>
                <th>2nd</th>
                <th>Rarity</th>
                <th>Text</th>
                <th aria-label="Add" />
              </tr>
            </thead>
            <tbody>
              {g.cards.map((card) => {
                const count = counts.get(card.number) ?? 0;
                return (
                  <tr
                    key={card.number}
                    className={`dbx-table__row${count > 0 ? ' is-in-deck' : ''}`}
                    onClick={() => onOpen(card)}
                    {...bind(card)}
                  >
                    <td className="dbx-table__name">{card.name}</td>
                    <td>
                      <span className={`dbx-color dbx-color--${card.color}`}>{card.color}</span>
                    </td>
                    <td>
                      <DiceValue value={card.value} dieColor={card.dieColor} className="dice--mini" />
                    </td>
                    <td>
                      {card.secondaryValue ? (
                        <DiceValue
                          value={card.secondaryValue.value}
                          dieColor={card.secondaryValue.dieColor}
                          className="dice--mini"
                        />
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="dbx-table__rarity">{card.rarity}</td>
                    <td className="dbx-table__text muted">{snippet(card.rulesText)}</td>
                    <td className="dbx-table__add">
                      <QuantityControl
                        count={count}
                        onAdd={() => onAdd(card.number)}
                        onSet={(n) => onSet(card.number, n)}
                        onSub={() => onSub(card.number)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
      {node}
    </div>
  );
}
