import type { CardData } from '@mood-swings/engine';
import { db } from '../../game/db.js';
import { Card, DiceValue } from '../Card.js';

// The CardDB only exposes get(number); the rules reference talks about cards by
// name, so build a name -> card index once and share it across both surfaces.
const BY_NAME = new Map<string, CardData>(db.all().map((c) => [c.name, c]));

/** Resolve one of the extended-rules example cards by its printed name. */
export function cardByName(name: string): CardData | undefined {
  return BY_NAME.get(name);
}

/**
 * A reusable example-card figure: the app's OWN large card face (renderer +
 * data/cards.json, never lifted WotC art) plus a caption carrying the value and
 * printed rules text. The caption keeps the figure readable even when the remote
 * card art is blocked and the CSS fallback face shows instead. Shared by the
 * full How-to-Play view so every card reference stays consistent.
 */
export function ExampleFigure({ name, note }: { name: string; note?: string }) {
  const card = cardByName(name);
  if (!card) return null;
  return (
    <figure className="rules-fig">
      <div className="rules-fig__card">
        <Card card={card} large showArt />
      </div>
      <figcaption className="rules-fig__cap">
        <span className="rules-fig__name">
          {card.name}
          <span className="rules-fig__die">
            <DiceValue value={card.value} dieColor={card.dieColor} className="dice--mini" />
          </span>
        </span>
        {card.rulesText && <span className="rules-fig__text">{card.rulesText}</span>}
        {note && <span className="rules-fig__note">{note}</span>}
      </figcaption>
    </figure>
  );
}

/** A wrapping row of example figures (e.g. the effect-type gallery). */
export function FigureRow({ names }: { names: string[] }) {
  return (
    <div className="rules-figrow">
      {names.map((n) => (
        <ExampleFigure key={n} name={n} />
      ))}
    </div>
  );
}

/** The twelve anatomy callouts, keyed to real fields on the sample card. */
const ANATOMY: { n: number; label: string; desc: (c: CardData) => string }[] = [
  { n: 1, label: 'Name', desc: (c) => `An emotion or mental state — here, ${c.name}.` },
  { n: 2, label: 'Frame / Color', desc: (c) => `One of five colors (white, blue, black, red, green). This card is ${c.color}; each color has its own frame.` },
  { n: 3, label: 'Reminder icon (!)', desc: () => 'An exclamation point appears when a card has an ability that affects the game while it stays in play (other than changing its own value).' },
  { n: 4, label: 'Value', desc: (c) => `What the card is worth when scored, shown as a die top-right. A white die is a fixed value; a black die (like this ${c.dieColor} one) is variable and must be re-checked whenever you total your score.` },
  { n: 5, label: 'Art', desc: () => 'An early sketch of art from a published Magic: The Gathering card.' },
  { n: 6, label: 'Rules text', desc: (c) => `What the card does. Italic parenthetical text is reminder text (clarification, not new rules). ${c.name}: “${c.rulesText ?? ''}”` },
  { n: 7, label: 'Secondary value', desc: (c) => (c.secondaryValue ? `A second possible value in the lower-left corner (here ${c.secondaryValue.value}${c.secondaryValue.value > 6 ? ', drawn as two dice added together' : ''}). Rotate the card 180° so the active value sits top-right.` : 'Some cards carry a second possible value in the lower-left corner; rotate 180° so the active value sits top-right.') },
  { n: 8, label: 'First Edition symbol', desc: () => 'Marks the first printing.' },
  { n: 9, label: 'Collector number', desc: (c) => `1–134. Numbered by color, then alphabetically within each color — this is #${c.number}. #134 is the foil Love headliner.` },
  { n: 10, label: 'Color (text)', desc: (c) => `The color spelled out for accessibility: ${c.color}.` },
  { n: 11, label: 'Artist', desc: () => 'The illustrator credit for the card art.' },
  { n: 12, label: 'Rarity', desc: (c) => `Common, uncommon, rare, or mythic rare (most to least frequent). This card is ${c.rarity}.` },
];

/**
 * The "anatomy of a card" labeled figure: a real rendered card beside a numbered
 * legend of callouts 1–12, each populated from that card's actual data.
 */
export function AnatomyFigure({ name }: { name: string }) {
  const card = cardByName(name);
  if (!card) return null;
  return (
    <div className="rules-anatomy">
      <figure className="rules-anatomy__card">
        <Card card={card} large showArt />
        <figcaption className="muted">{card.name} — #{card.number}, {card.color}, {card.rarity}</figcaption>
      </figure>
      <ol className="rules-anatomy__legend">
        {ANATOMY.map((a) => (
          <li key={a.n}>
            <span className="rules-anatomy__pin">{a.n}</span>
            <span className="rules-anatomy__body">
              <strong>{a.label}</strong> — {a.desc(card)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
