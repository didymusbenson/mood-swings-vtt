import { useEffect } from 'react';
import { SimplifiedRulesBody } from './rules/simplified.js';

/**
 * In-game "(?)" reference: a simplified-rules modal built on the shared overlay
 * pattern (same as DiscardInspector). Dims the board, closes on Esc / scrim /
 * Close, and never touches game state. Deliberately simplified-only — no link to
 * the full How-to-Play view or any external site.
 */
export function RulesModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="inspector" role="dialog" aria-modal="true" aria-label="How to play">
      <div className="overlay__scrim" onClick={onClose} />
      <div className="inspector__panel">
        <header className="inspector__head">
          <h2 className="inspector__title">How to play</h2>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </header>
        <SimplifiedRulesBody />
      </div>
    </div>
  );
}
