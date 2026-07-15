import type { CardData, CardDB, DeckValidation } from '@mood-swings/engine';
import { minDeckSize } from '@mood-swings/engine';
import type { DeckCounts } from '../../game/deckModel.js';
import { totalCards, rarityBreakdown, colorBreakdown } from '../../game/deckModel.js';
import { QuantityControl } from './QuantityControl.js';

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'mythic'] as const;
const COLOR_ORDER = ['white', 'blue', 'black', 'red', 'green'] as const;

interface DeckListPanelProps {
  counts: DeckCounts;
  db: CardDB;
  onAdd(n: number): void;
  onSet(n: number, c: number): void;
  onSub(n: number): void;
  onClear(): void;
  onOpen(card: CardData): void;
  validation: DeckValidation;
}

/** The right-rail deck list: running total, breakdowns, validity, and the
 *  included moods with steppers. */
export function DeckListPanel({ counts, db, onAdd, onSet, onSub, onClear, onOpen, validation }: DeckListPanelProps) {
  const total = totalCards(counts);
  const min = minDeckSize(2);
  const rar = rarityBreakdown(counts, db);
  const col = colorBreakdown(counts, db);
  const entries = [...counts.keys()].sort((a, b) => a - b);

  return (
    <aside className="dbx-decklist" aria-label="Deck list">
      <header className="dbx-decklist__head">
        <div className="dbx-decklist__count">
          <strong>{total}</strong> <span className="muted">/ {min} min</span>
        </div>
        <button
          type="button"
          className="btn dbx-decklist__clear"
          onClick={() => {
            if (total === 0 || window.confirm('Clear the whole deck?')) onClear();
          }}
          disabled={total === 0}
        >
          Clear
        </button>
      </header>

      <div className={`dbx-decklist__valid ${validation.ok ? 'ok' : 'bad'}`}>
        {validation.ok ? 'Valid deck' : validation.errors.join(' ')}
      </div>

      <div className="dbx-breakdown">
        {RARITY_ORDER.map((r) => (
          <span key={r} className="dbx-breakdown__chip" title={r}>
            {r.charAt(0).toUpperCase()} {rar[r]}
          </span>
        ))}
        <span className="dbx-breakdown__sep" aria-hidden />
        {COLOR_ORDER.map((c) => (
          <span key={c} className={`dbx-breakdown__chip dbx-color--${c}`} title={c}>
            {(col[c] ?? 0)}
          </span>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="dbx-decklist__empty muted">No cards yet. Add cards from the browser.</p>
      ) : (
        <ul className="dbx-decklist__list">
          {entries.map((n) => {
            const card = db.get(n);
            const count = counts.get(n) ?? 0;
            return (
              <li
                key={n}
                className={`dbx-decklist__row dbx-swatchrow--${card.color}`}
                onClick={() => onOpen(card)}
              >
                <span className="dbx-swatch" aria-hidden />
                <span className="dbx-decklist__name">{card.name}</span>
                <QuantityControl
                  count={count}
                  onAdd={() => onAdd(n)}
                  onSet={(c) => onSet(n, c)}
                  onSub={() => onSub(n)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
