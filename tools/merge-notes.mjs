#!/usr/bin/env node
// Parse docs/card-notes.md (Mark Rosewater's clarifications) into
// data/card-notes.json, keyed by collector number.
//
// Each card section is a heading `## <Name> — _<Color> <Rarity>_`, followed by
// a `>` rules-quote line and any number of `- ` bullet lines (the actual
// clarifications). We keep only the bullets, and resolve `<Name>` to a collector
// number using data/cards.json, matching ONLY within the playable pool (any
// rarity containing "headliner" or "helper" is excluded) so names like the two
// "Love" printings are unambiguous.
//
// No network. Run from the repo root: `node tools/merge-notes.mjs`.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const notesPath = root + 'docs/card-notes.md';
const cardsPath = root + 'data/cards.json';
const outPath = root + 'data/card-notes.json';

/** @type {Array<{ number: number; name: string; rarity: string }>} */
const cards = JSON.parse(readFileSync(cardsPath, 'utf8'));

// Playable pool = anything whose rarity is not a headliner/helper printing.
const isPlayable = (rarity) => !/headliner|helper/i.test(rarity);
const numberByName = new Map();
for (const c of cards) {
  if (!isPlayable(c.rarity)) continue;
  numberByName.set(c.name.toLowerCase(), c.number);
}

const md = readFileSync(notesPath, 'utf8');
const lines = md.split(/\r?\n/);

/** @type {Record<string, string[]>} */
const out = {};
const unresolved = [];
let matched = 0;

let current = null; // { number, notes }
for (const line of lines) {
  const heading = line.match(/^##\s+(.+?)\s+—\s+_/);
  if (heading) {
    const name = heading[1].trim();
    const number = numberByName.get(name.toLowerCase());
    if (number === undefined) {
      current = null;
      unresolved.push(line.trim());
    } else {
      current = { number, notes: [] };
      out[String(number)] = current.notes;
      matched += 1;
    }
    continue;
  }
  if (!current) continue;
  const bullet = line.match(/^-\s+(.*)$/);
  if (bullet) current.notes.push(bullet[1].trim());
}

// Drop any heading that resolved but had zero bullet clarifications.
for (const key of Object.keys(out)) {
  if (out[key].length === 0) delete out[key];
}

writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');

process.stderr.write(`merge-notes: matched ${matched} headings, ${Object.keys(out).length} with notes → ${outPath}\n`);
if (unresolved.length) {
  process.stderr.write(`merge-notes: ${unresolved.length} heading(s) did not resolve:\n`);
  for (const h of unresolved) process.stderr.write(`  ${h}\n`);
}
