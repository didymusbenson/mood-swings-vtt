// Card effect modules — one file per colour, each registering effects by
// collector number via registerEffects(). Importing this module wires up the
// whole set. See docs/CARD_AUTHORING.md.

import './white.js'; // #1–#26
import './blue.js'; // #27–#52
import './black.js'; // #53–#79
import './red.js'; // #80–#106 (incl. #92 Glee)
import './green.js'; // #107–#134 (incl. #127/#134 Love)

// Target specs (UI metadata for the play/targeting flow).
import './specs/white.js';
import './specs/blue.js';
import './specs/black.js';
import './specs/red.js';
import './specs/green.js';

export { registerEffects, effectsFor, CardDB } from './registry.js';
