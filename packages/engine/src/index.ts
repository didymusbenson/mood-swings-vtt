// Public API for the Mood Swings engine.

export * from './types.js';
export * from './effects.js';
export { Engine, type Action, type SetupOptions } from './engine.js';
export { CardDB, registerEffects, effectsFor } from './cards/registry.js';
export { loadCardDB, normaliseCard, type RawCard } from './data.js';
export {
  randomBoxDeck,
  validateCustomDeck,
  minDeckSize,
  BOX_COLLATION,
  CUSTOM_MIN_FOR_TWO_PLAYERS,
  type DeckValidation,
} from './deck.js';
export * as queries from './queries.js';
export {
  registerSpec,
  specFor,
  legalTargets,
  isLegalDrop,
  playsImmediately,
  hasRequiredTargets,
  isSingleTarget,
  firstBoardSlot,
  type ChoiceSpec,
  type ChoiceSlot,
  type MoodFilter,
  type HandFilter,
  type CardLookup,
} from './cards/choice-spec.js';
// Importing the card index registers all effects AND specs as a side effect.
import './cards/index.js';
