// Build data/card-index.json from the Moodfall search page HTML.
// The search page lists all 135 entries as <a href="/card/1ed/<n>/<slug>">.
// Usage: node tools/build-index.mjs [path-to-search-page.html]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { colorForNumber } from './parse-card.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = process.argv[2] || path.join(__dirname, 'samples', 'search-page.html');
const html = fs.readFileSync(src, 'utf8');

const re = /href="\/card\/1ed\/(\d+)\/([^"]+)"[^>]*>\s*<div class="card-name">([^<]+)<\/div>/g;
const cards = [];
for (const m of html.matchAll(re)) {
  const number = Number(m[1]);
  cards.push({
    number,
    slug: m[2],
    name: m[3].trim(),
    color: colorForNumber(number),
    url: `/card/1ed/${m[1]}/${m[2]}`,
  });
}
cards.sort((a, b) => a.number - b.number);

const out = path.join(__dirname, '..', 'data', 'card-index.json');
fs.writeFileSync(out, JSON.stringify(cards, null, 2) + '\n');
console.log(`Wrote ${cards.length} cards to ${out}`);
const byColor = cards.reduce((acc, c) => ((acc[c.color] = (acc[c.color] || 0) + 1), acc), {});
console.log('By color:', byColor);
