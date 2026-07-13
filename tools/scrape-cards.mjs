// Scrape full card data for all cards in data/card-index.json from
// moodswings.scryfall.com and write data/cards.json.
//
// Run this WHERE THE NETWORK CAN REACH scryfall.com (e.g. your local machine,
// or a Claude Code web session whose environment network policy allows it —
// the default restricted policy in this repo's session BLOCKS scryfall, which
// is why the data isn't committed yet).
//
// Usage:  node tools/scrape-cards.mjs
// Node 18+ (uses global fetch). No dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCardHtml } from './parse-card.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'https://moodswings.scryfall.com';
const index = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'card-index.json'), 'utf8')
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'mood-swings-vtt/data-import' } });
      if (res.ok) return await res.text();
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(1000 * 2 ** i);
    }
  }
}

const cards = [];
const problems = [];
for (const entry of index) {
  try {
    const html = await fetchWithRetry(`${BASE}${entry.url}`);
    const card = parseCardHtml(html);
    // Prefer the authoritative index name/slug/color; fill from parse otherwise.
    cards.push({ ...card, name: entry.name, slug: entry.slug, color: entry.color });
    const flags = [];
    if (card.value == null) flags.push('no-value');
    if (card.rarity == null) flags.push('no-rarity');
    console.log(
      `#${entry.number} ${entry.name}  val=${card.value} die=${card.dieColor} ${card.rarity}` +
        (flags.length ? `  ⚠ ${flags.join(',')}` : '')
    );
    if (flags.length) problems.push({ number: entry.number, name: entry.name, flags });
  } catch (e) {
    console.error(`#${entry.number} ${entry.name}  FAILED: ${e.message}`);
    problems.push({ number: entry.number, name: entry.name, error: String(e) });
  }
  await sleep(250); // be polite
}

const out = path.join(__dirname, '..', 'data', 'cards.json');
fs.writeFileSync(out, JSON.stringify(cards, null, 2) + '\n');
console.log(`\nWrote ${cards.length}/${index.length} cards to ${out}`);
if (problems.length) console.log(`Review ${problems.length} flagged card(s):`, problems);
