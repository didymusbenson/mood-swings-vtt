// Value-highlight provenance metadata — GENERATED RESEARCH OUTPUT.
//
// This module is the consolidated output of the Value Transparency "highlight
// provenance" research spike (docs/features/value-transparency.md → "Highlight
// provenance"). For every mood whose OWN printed text drives its value, it records:
//   - `clause`:    the EXACT verbatim substring of the card's printed rulesText
//                  (data/cards.json) that the UI should wrap in a <mark>; and
//   - `condition`: a ReadContext predicate that is true when THAT clause is
//                  currently driving `self`'s value (i.e. the highlighted branch
//                  is the one in effect right now).
//
// It deliberately lives in ONE file (not scattered into white/blue/black/red/
// green.ts) so the full provenance map is auditable in a single place, and it
// mirrors the specFor / effectsFor registry pattern: a Map populated by
// `registerHighlight`, read via `highlightFor`.
//
// Each `condition` reuses the SAME board predicate as the corresponding card's
// `intrinsicValue` hook, so provenance stays in lock-step with the value logic.
// The two families are:
//   - boost-flag cards (an "If you do, this mood's value becomes […]" clause set
//     at play time): condition is `ctx => !!ctx.self.data.boost`.
//   - board-query cards ("While in play — this mood's value is […] if <board>"):
//     condition re-evaluates the same countColor / mood-count / hand / discard test.
//
// This map ONLY covers the SELF-modification case ("Modifying rule highlighted").
// The external "Modified by {cardname}" case (suppression, another mood's
// whileInPlay modifier) is derived at runtime by scanning the board and needs no
// per-card metadata here.
//
// Audit / regeneration notes: docs/value-transparency-card-audit.md.

import type { Color, PlayerId } from '../types.js';
import type { ReadContext } from '../effects.js';

/** Provenance for a single self-highlighting clause. */
export interface HighlightMeta {
  /**
   * Exact substring of the card's printed `rulesText` to wrap in a <mark>.
   * MUST string-match verbatim (including brackets/punctuation) so the app can
   * locate it with a plain `indexOf`.
   */
  readonly clause: string;
  /** True when this clause is currently the branch driving `self`'s value. */
  readonly condition: (ctx: ReadContext) => boolean;
  /**
   * Optional override for external naming. Not used by the default flow — the
   * "Modified by {cardname}" line is derived at runtime, not from this map.
   */
  readonly external?: string;
}

const highlightByNumber = new Map<number, HighlightMeta>();

/** Register a card's self-highlight provenance. Called once per card at load. */
export function registerHighlight(cardNumber: number, meta: HighlightMeta): void {
  highlightByNumber.set(cardNumber, meta);
}

/** Provenance for a card number, or undefined for fixed/vanilla cards. */
export function highlightFor(cardNumber: number): HighlightMeta | undefined {
  return highlightByNumber.get(cardNumber);
}

// ---------------------------------------------------------------------------
// Shared predicate atoms (mirror the intrinsicValue hooks they correspond to).
// ---------------------------------------------------------------------------

/** Boost-flag set at play time — the "If you do, …becomes […]" family. */
const boostSet = (ctx: ReadContext): boolean => !!ctx.self.data.boost;

/** Two-or-more moods of the given colours in play (honours Imagination override). */
const twoOrMore = (a: Color, b: Color) => (ctx: ReadContext): boolean =>
  ctx.countColor(a) + ctx.countColor(b) >= 2;

/** All five printed colours, and the six the count query can return. */
const FIVE: Color[] = ['white', 'blue', 'black', 'red', 'green'];
const ALL_COLORS: Color[] = ['white', 'blue', 'black', 'red', 'green', 'colorless'];

/** Distinct in-play colours among a player's moods (honours colour override). */
const distinctColors = (ctx: ReadContext, pid: PlayerId): number =>
  new Set(ctx.moodsOf(pid).map((m) => ctx.colorOf(m))).size;

// ---------------------------------------------------------------------------
// Registrations — one per card with `highlight.hasHighlight === true` (42 cards).
// Grouped by colour file of origin for readability.
// ---------------------------------------------------------------------------

// --- White (#1–#26) ---
registerHighlight(1, { clause: "this mood's value becomes [6][1]", condition: boostSet }); // Altruism
registerHighlight(4, {
  clause: "This mood's value is [5] if you didn't go first this round.",
  condition: (ctx) => ctx.self.owner !== ctx.state.firstPlayer,
}); // Chivalry
registerHighlight(8, { clause: "this mood's value becomes [5]", condition: boostSet }); // Dignity
registerHighlight(9, {
  clause: "This mood's value is [3] if there are two or more black and/or red moods.",
  condition: twoOrMore('black', 'red'),
}); // Discipline
registerHighlight(18, {
  clause: "This mood's value is [6] if there are two or more green and/or blue moods.",
  condition: twoOrMore('green', 'blue'),
}); // Loyalty
registerHighlight(21, {
  clause: "This mood's value is [1] if you played it this round.",
  condition: (ctx) => ctx.self.data.playedRound === ctx.state.round,
}); // Patience

// --- Blue (#27–#52) ---
registerHighlight(27, {
  clause: "This mood's value is [3] if there are two or more red and/or green moods.",
  condition: twoOrMore('red', 'green'),
}); // Ambivalence
registerHighlight(33, { clause: "this mood's value becomes [6]", condition: boostSet }); // Curiosity
registerHighlight(47, {
  clause: "This mood's value is [6] if there are two or more white and/or black moods.",
  condition: twoOrMore('white', 'black'),
}); // Obsession

// --- Black (#53–#79) ---
registerHighlight(58, { clause: "this mood's value becomes [6]", condition: boostSet }); // Condescension
registerHighlight(62, {
  clause: "If you do, this mood's value becomes [6].",
  condition: boostSet,
}); // Cynicism
registerHighlight(63, {
  clause: "This mood's value is [3] if there are two or more green and/or white moods.",
  condition: twoOrMore('green', 'white'),
}); // Disgust
registerHighlight(64, {
  clause: "This mood's value increases by [2] for each mood your moodiest opponent has.",
  condition: (ctx) => ctx.opponentsOf(ctx.self.owner).some((p) => ctx.moodsOf(p).length > 0),
}); // Envy
registerHighlight(70, {
  clause:
    "This mood's value is [6][2] if there are two or more cards in the discard pile that share a color.",
  condition: (ctx) => {
    const counts = new Map<Color, number>();
    for (const n of ctx.state.discard) {
      const col = ctx.cardData(n).color;
      counts.set(col, (counts.get(col) ?? 0) + 1);
    }
    return [...counts.values()].some((v) => v >= 2);
  },
}); // Misery
registerHighlight(72, {
  clause: "This mood's value is [6] if there are two or more blue and/or red moods.",
  condition: twoOrMore('blue', 'red'),
}); // Pity
registerHighlight(74, {
  clause: "This mood's value increases by [2] for each card in the discard pile.",
  condition: (ctx) => ctx.state.discard.length > 0,
}); // Sadness
registerHighlight(77, {
  clause: "This mood's value is [6][1] if you have more moods than each other player.",
  condition: (ctx) => {
    const mine = ctx.moodsOf(ctx.self.owner).length;
    return ctx.opponentsOf(ctx.self.owner).every((p) => mine > ctx.moodsOf(p).length);
  },
}); // Superiority
registerHighlight(79, {
  clause:
    "This mood's value increases by [1] for each of your moods (including itself). If there are no cards in your hand, this mood's value instead increases by [3] for each of your moods (including itself).",
  condition: (ctx) => ctx.moodsOf(ctx.self.owner).length > 0,
}); // Vanity

// --- Red (#80–#106) ---
registerHighlight(81, {
  clause: "This mood's value is [5] if any opponent has three or more cards in hand.",
  condition: (ctx) =>
    ctx.opponentsOf(ctx.self.owner).some((p) => (ctx.state.hands[p]?.length ?? 0) >= 3),
}); // Animosity
registerHighlight(87, { clause: "this mood's value becomes [5]", condition: boostSet }); // Embarrassment
registerHighlight(88, {
  clause: "This mood's value is [6] if there are two or more black and/or green moods.",
  condition: twoOrMore('black', 'green'),
}); // Excitement
registerHighlight(90, {
  clause: "This mood's value is [3] if there are two or more white and/or blue moods.",
  condition: twoOrMore('white', 'blue'),
}); // Frustration
registerHighlight(92, {
  clause: "This mood's value is [6] if you played it this round.",
  condition: (ctx) => ctx.self.data.playedRound === ctx.state.round,
}); // Glee
registerHighlight(95, { clause: "this mood's value becomes [6][3]", condition: boostSet }); // Infatuation
registerHighlight(104, {
  clause: "This mood's value is [5] if you went first this round.",
  condition: (ctx) => ctx.self.owner === ctx.state.firstPlayer,
}); // Triumph

// --- Green (#107–#134) ---
registerHighlight(109, {
  clause:
    "This mood's value is [6][1] if there are more colors among your moods than among each other player's moods.",
  condition: (ctx) => {
    const me = ctx.self.owner;
    const mine = distinctColors(ctx, me);
    return ctx.opponentsOf(me).every((o) => mine > distinctColors(ctx, o));
  },
}); // Celebration
registerHighlight(110, { clause: "this mood's value becomes [5]", condition: boostSet }); // Cheer
registerHighlight(111, { clause: "this mood's value becomes [5]", condition: boostSet }); // Delight
registerHighlight(112, {
  clause: "This mood's value is [6] if there are three or more moods that share a color.",
  condition: (ctx) => ALL_COLORS.some((c) => ctx.countColor(c) >= 3),
}); // Determination
registerHighlight(113, {
  clause: "This mood's value is [3] if there are two or more blue and/or black moods.",
  condition: twoOrMore('blue', 'black'),
}); // Disregard
registerHighlight(115, {
  clause: "This mood's value is [6] if there are two or more red and/or white moods.",
  condition: twoOrMore('red', 'white'),
}); // Enjoyment
registerHighlight(117, {
  clause:
    "This mood's value increases by [1] for each mood (including itself and other players' moods).",
  condition: (ctx) => ctx.allMoods().length > 0,
}); // Euphoria
registerHighlight(118, { clause: "this mood's value becomes [6][1]", condition: boostSet }); // Fascination
registerHighlight(119, {
  clause: "This mood's value is [6][1] if each player has three or more moods.",
  condition: (ctx) => ctx.state.players.every((p) => ctx.moodsOf(p.id).length >= 3),
}); // Fondness
registerHighlight(122, {
  clause: "This mood's value is [6][2] if a player has both a red mood and a white mood.",
  condition: (ctx) =>
    ctx.state.players.some((p) => {
      const cols = new Set(ctx.moodsOf(p.id).map((m) => ctx.colorOf(m)));
      return cols.has('red') && cols.has('white');
    }),
}); // Happiness
registerHighlight(127, {
  clause:
    "This mood's value is [6][6] if there's a white mood, a blue mood, a black mood, a red mood, and a green mood (including this one).",
  condition: (ctx) => FIVE.every((c) => ctx.countColor(c) >= 1),
}); // Love (#127)
registerHighlight(129, {
  clause: "This mood's value is [6] if you have an even number of moods (including this one).",
  condition: (ctx) => ctx.moodsOf(ctx.self.owner).length % 2 === 0,
}); // Serenity
registerHighlight(130, {
  clause: "This mood's value increases by [1] for each card in your hand.",
  condition: (ctx) => (ctx.state.hands[ctx.self.owner]?.length ?? 0) > 0,
}); // Sloth
registerHighlight(131, {
  clause: "This mood's value is [6] if you have an odd number of moods (including this one).",
  condition: (ctx) => ctx.moodsOf(ctx.self.owner).length % 2 === 1,
}); // Tranquility
registerHighlight(132, {
  clause: "This mood's value is [6][1] if a card was put into the discard pile this round.",
  condition: (ctx) => ctx.state.discardedThisRound > 0,
}); // Vulnerability
registerHighlight(133, {
  clause:
    "This mood's value increases by [2] for each mood of the chosen color and each card in the discard pile of the chosen color.",
  condition: (ctx) => {
    const col = ctx.self.data.wonderColor as Color | undefined;
    if (!col) return false;
    const discardN = ctx.state.discard.filter((n) => ctx.cardData(n).color === col).length;
    return ctx.countColor(col) + discardN > 0;
  },
}); // Wonder
registerHighlight(134, {
  clause:
    "This mood's value is [6][6] if there's a white mood, a blue mood, a black mood, a red mood, and a green mood (including this one).",
  condition: (ctx) => FIVE.every((c) => ctx.countColor(c) >= 1),
}); // Love (#134 foil)
