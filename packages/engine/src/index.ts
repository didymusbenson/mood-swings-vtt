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
  standardDeckNotice,
  BOX_COLLATION,
  CUSTOM_MIN_FOR_TWO_PLAYERS,
  STANDARD_DECK_SIZE,
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
export {
  registerHighlight,
  highlightFor,
  type HighlightMeta,
} from './cards/highlights.js';
export {
  wouldBeValue,
  valueProvenance,
  TARGET_DEPENDENT_VALUE_CARDS,
  type WouldBeResult,
  type WouldBeChoices,
  type ValueProvenance,
  type ExternalModifier,
} from './value-transparency.js';
// Importing the card index registers all effects AND specs as a side effect.
import './cards/index.js';
