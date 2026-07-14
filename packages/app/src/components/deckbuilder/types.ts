import type { CardData } from '@mood-swings/engine';
import type { CardGroup } from '../../game/browse.js';
import type { DeckCounts } from '../../game/deckModel.js';

/** The four card-browser display modes. `detailed` is the default. */
export type ViewMode = 'simple' | 'detailed' | 'visual' | 'visual-detail';

/** Shared props every browser view receives from the Deckbuilder container. */
export interface ViewProps {
  /** Cards grouped into labeled sections by the active sort (browse.groupBySort). */
  groups: CardGroup[];
  /** Current deck counts, so each row knows its copy count. */
  counts: DeckCounts;
  /** Add one copy of card `n`. */
  onAdd(n: number): void;
  /** Set the exact copy count of card `n` (<=0 removes). */
  onSet(n: number, c: number): void;
  /** Subtract one copy of card `n` (removing at 0). */
  onSub(n: number): void;
  /** Open the full-detail modal for a card (click on the card body). */
  onOpen(card: CardData): void;
}
