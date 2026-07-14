import type React from 'react';
import { useEffect, useState } from 'react';

interface QuantityControlProps {
  /** Current copies in the deck (0 → show the Add button). */
  count: number;
  onAdd(): void;
  onSet(n: number): void;
  onSub(): void;
  className?: string;
}

/** Swallow pointer/click bubbling so the control never opens the card modal or
 *  triggers a hover-preview on the row behind it. */
function stop(e: React.SyntheticEvent) {
  e.stopPropagation();
}

/**
 * The add / quantity control used on every browser row and in the deck-list
 * panel and modal. count===0 renders a clear "+ Add"; count>0 renders an inline
 * "− [X] +" stepper whose [X] box is directly editable (commit on blur/Enter;
 * blank or invalid reverts to the last count).
 */
export function QuantityControl({ count, onAdd, onSet, onSub, className }: QuantityControlProps) {
  const [draft, setDraft] = useState(String(count));

  // Keep the editable box in sync when the count changes from elsewhere
  // (browser [+], deck-list edits, load/import).
  useEffect(() => setDraft(String(count)), [count]);

  if (count <= 0) {
    return (
      <button
        type="button"
        className={`dbx-add${className ? ` ${className}` : ''}`}
        onClick={(e) => {
          stop(e);
          onAdd();
        }}
        onPointerDown={stop}
        aria-label="Add to deck"
      >
        + Add
      </button>
    );
  }

  const commit = () => {
    const n = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(n)) {
      setDraft(String(count)); // revert
      return;
    }
    const next = Math.max(0, Math.floor(n));
    if (next !== count) onSet(next);
    else setDraft(String(count));
  };

  return (
    <span
      className={`dbx-stepper${className ? ` ${className}` : ''}`}
      onClick={stop}
      onPointerDown={stop}
    >
      <button type="button" className="dbx-step" onClick={(e) => { stop(e); onSub(); }} aria-label="Remove one copy">
        −
      </button>
      <input
        className="dbx-qty"
        type="number"
        min={0}
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            setDraft(String(count));
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label="Copies in deck"
      />
      <button type="button" className="dbx-step" onClick={(e) => { stop(e); onAdd(); }} aria-label="Add one copy">
        +
      </button>
    </span>
  );
}
