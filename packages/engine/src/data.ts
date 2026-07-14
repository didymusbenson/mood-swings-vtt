// Load and normalise the scraped card data (data/cards.json) into a CardDB.
// The scraper is faithful to the source, so a couple of fields need coercing:
//   - #135 Hurt Feelings has value null (it's a non-scoring helper) -> 0
//   - #134/#135 use free-text rarities ("headliner, foil", "helper")

import type { CardData, Color, DieColor, Rarity } from './types.js';
import { CardDB } from './cards/registry.js';

/** The raw shape emitted by tools/scrape-cards.mjs. */
export interface RawCard {
  number: number;
  name: string;
  slug: string;
  color: Color;
  value: number | null;
  dieColor: DieColor;
  secondaryValue: { value: number; dieColor: DieColor } | null;
  rarity: string;
  rulesText: string | null;
  artist?: string | null;
  image: string;
  set: string;
}

function normaliseRarity(raw: string): Rarity {
  const r = raw.toLowerCase();
  if (r.includes('headliner')) return 'headliner';
  if (r.includes('helper')) return 'helper';
  if (r.includes('mythic')) return 'mythic';
  if (r.includes('uncommon')) return 'uncommon';
  if (r.includes('common')) return 'common';
  if (r.includes('rare')) return 'rare';
  return 'common';
}

export function normaliseCard(raw: RawCard): CardData {
  return {
    number: raw.number,
    name: raw.name,
    slug: raw.slug,
    color: raw.color,
    value: raw.value ?? 0,
    dieColor: raw.dieColor,
    secondaryValue: raw.secondaryValue,
    rarity: normaliseRarity(raw.rarity),
    rulesText: raw.rulesText,
    image: raw.image,
    set: raw.set,
    artist: raw.artist ?? null,
  };
}

export function loadCardDB(raw: RawCard[]): CardDB {
  return new CardDB(raw.map(normaliseCard));
}
