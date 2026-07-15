// Loads the shared card database and wires up card effect modules.
//
// The `@mood-swings/engine/cards` side-effect import registers every card's
// computed-value behaviour; without it, values like Glee/Love/Chivalry would
// render with their printed die instead of their live value.
import '@mood-swings/engine/cards';

import { loadCardDB, type RawCard } from '@mood-swings/engine';
import rawCards from '../../../../data/cards.json';
import cardNotes from '../../../../data/card-notes.json';

// The JSON is the faithful scraper output (RawCard[]); loadCardDB normalises it.
export const RAW_CARDS = rawCards as unknown as RawCard[];
export const db = loadCardDB(RAW_CARDS);

// Join Mark Rosewater's clarifications (data/card-notes.json, keyed by collector
// number) onto each card's optional `notes`. Kept in a separate file so the
// scraper output (data/cards.json) stays pristine. Cards without notes are left
// untouched.
const NOTES = cardNotes as Record<string, string[]>;
for (const card of db.all()) {
  const notes = NOTES[String(card.number)];
  if (notes) card.notes = notes;
}
