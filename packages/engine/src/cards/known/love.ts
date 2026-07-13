// #134 Love (green, headliner foil). Primary [4], secondary [6][6]=12, black die.
// "While in play — This mood's value is [6][6] if there's a white mood, a blue
//  mood, a black mood, a red mood, and a green mood (including this one)."
import { registerEffects } from '../registry.js';
import type { Color } from '../../types.js';

const FIVE: Color[] = ['white', 'blue', 'black', 'red', 'green'];

registerEffects(134, {
  intrinsicValue(ctx) {
    const allColors = FIVE.every((c) => ctx.countColor(c) >= 1);
    return allColors ? 12 : 4;
  },
});
