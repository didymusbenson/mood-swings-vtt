// #92 Glee (red, common). Primary [0], secondary [6], black die.
// Rules text: "While in play — This mood's value is [6] if you played it this round."
import { registerEffects } from '../registry.js';

registerEffects(92, {
  intrinsicValue(ctx) {
    const playedRound = ctx.self.data.playedRound as number | undefined;
    return playedRound === ctx.state.round ? 6 : 0;
  },
});
