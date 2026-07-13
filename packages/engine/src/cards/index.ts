// Card effect modules. As data/cards.json lands, one module per card is added
// here and registered via registerEffects(number, effects).
//
// Known-text cards encoded so far (reference implementations):
//   #92 Glee   — round-scoped self value
//   #134 Love  — "all five colours" board query
//
// The remaining ~125 effects are a systematic follow-up now that
// data/cards.json is available (see REQUIREMENTS.md / task list).

import './white.js'; // #1–#26
import './known/glee.js'; // #92 (red — pending red.ts)
import './known/love.js'; // #134 (green — pending green.ts)

export { registerEffects, effectsFor, CardDB } from './registry.js';
