import { useState } from 'react';
import { validateCustomDeck } from '@mood-swings/engine';
import { db } from '../game/db.js';
import type { DeckCounts } from '../game/deckModel.js';
import { flatten, totalCards } from '../game/deckModel.js';
import { Deckbuilder } from './deckbuilder/Deckbuilder.js';

interface DeckbuilderPageProps {
  /** Seed the working deck (e.g. when opened from a game setup with the current deck). */
  initialCounts?: DeckCounts;
  onBack: () => void;
  /**
   * When present, a "Use this deck" action hands the current deck back to the game setup
   * that opened the builder. Omitted when reached from the home menu (pure management).
   */
  onUseDeck?: (deck: number[]) => void;
}

/**
 * The standalone Deckbuilder page — a top-level destination for making, loading,
 * importing, and editing decks. Owns the working deck; saved decks persist to
 * localStorage (shared with game setup's saved-deck picker).
 */
export function DeckbuilderPage({ initialCounts, onBack, onUseDeck }: DeckbuilderPageProps) {
  const [counts, setCounts] = useState<DeckCounts>(() => new Map(initialCounts ?? new Map()));
  const flat = flatten(counts);
  const valid = validateCustomDeck(flat, 2).ok;

  return (
    <div className="dbx-page">
      <header className="dbx-page__bar">
        <button className="btn" onClick={onBack}>
          ← Back
        </button>
        <h1 className="dbx-page__title">Deckbuilder</h1>
        {onUseDeck ? (
          <button
            className="btn btn--primary"
            disabled={!valid}
            onClick={() => onUseDeck(flat)}
            title={valid ? 'Use this deck for the game' : `Deck isn't valid yet (${totalCards(counts)} cards)`}
          >
            Use this deck →
          </button>
        ) : (
          <span className="dbx-page__spacer" aria-hidden />
        )}
      </header>
      <Deckbuilder counts={counts} db={db} onChange={setCounts} />
    </div>
  );
}
