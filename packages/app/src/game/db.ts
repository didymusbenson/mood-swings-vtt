// Loads the shared card database and wires up card effect modules.
//
// The `@mood-swings/engine/cards` side-effect import registers every card's
// computed-value behaviour; without it, values like Glee/Love/Chivalry would
// render with their printed die instead of their live value.
import '@mood-swings/engine/cards';

import { loadCardDB, type RawCard } from '@mood-swings/engine';
import rawCards from '../../../../data/cards.json';

// The JSON is the faithful scraper output (RawCard[]); loadCardDB normalises it.
export const RAW_CARDS = rawCards as unknown as RawCard[];
export const db = loadCardDB(RAW_CARDS);
