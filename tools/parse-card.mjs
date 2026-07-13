// Parser for a Moodfall (moodswings.scryfall.com) server-rendered card page.
// The site is SSR, so every /card/1ed/<n>/<slug> page contains the full card
// data in its HTML. This module turns that HTML into a structured card record.
// No dependencies — regex/string extraction against the stable SSR structure.

const COLOR_BANDS = [
  { color: 'white', min: 1, max: 26 },
  { color: 'blue', min: 27, max: 52 },
  { color: 'black', min: 53, max: 79 },
  { color: 'red', min: 80, max: 106 },
  { color: 'green', min: 107, max: 134 }, // 134 = headliner foil Love (green)
];

// Color is derivable from collector number: numbering runs white→blue→black→
// red→green, alphabetical within each color. Verified against the 135-card
// search index (the alphabetical sequence restarts exactly at each boundary).
// #135 (Hurt Feelings) is the special multiplayer card — treated as colorless.
export function colorForNumber(n) {
  if (n === 135) return 'colorless';
  const band = COLOR_BANDS.find((b) => n >= b.min && n <= b.max);
  return band ? band.color : 'unknown';
}

const attr = (html, re) => {
  const m = html.match(re);
  return m ? m[1].trim() : null;
};

// Sum every [n] in a string, e.g. "[6][1]" -> 7, "[0]" -> 0.
function sumBrackets(str) {
  if (!str) return null;
  const nums = [...str.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
}

// Pull the innermost text of the first matching block, stripping tags.
function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract the primary value block: numeric value + die color (white/black).
function parsePrimaryValue(html) {
  const block = attr(
    html,
    /<div class="card-text-value"[^>]*>([\s\S]*?)<div class="reminder"/
  );
  const region = block ?? html;
  const dieColor = /large-dice[^"]*\bdark\b/.test(region) ? 'black' : 'white';
  const values = [...region.matchAll(/data-value="(\d+)"/g)].map((m) =>
    Number(m[1])
  );
  const value = values.length ? values.reduce((a, b) => a + b, 0) : null;
  return { value, dieColor };
}

// Extract the "Alternate score" (secondary value), if present.
function parseAltValue(html) {
  const block = attr(
    html,
    /<div class="card-text-alt-value"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<div class="footer-details"/
  );
  if (!block) return null;
  const dieColor = /large-dice[^"]*\bdark\b/.test(block) ? 'black' : 'white';
  const values = [...block.matchAll(/data-value="(\d+)"/g)].map((m) =>
    Number(m[1])
  );
  if (!values.length) return null;
  return { value: values.reduce((a, b) => a + b, 0), dieColor };
}

export function parseCardHtml(html) {
  // Name + collector number from the <title>/og:title: "Glee · 1ed #92 · ..."
  const ogTitle =
    attr(html, /property="og:title" content="([^"]+)"/) ||
    attr(html, /<title>([^<]+)<\/title>/);
  const titleName = ogTitle ? ogTitle.split('·')[0].trim() : null;
  const name = attr(html, /<h2[^>]*>([^<]+)<\/h2>/) || titleName;
  const number = Number(attr(html, /#(\d+)/) || attr(html, /·\s*1ed\s*#(\d+)/));

  // The meta description is the officially rendered summary:
  //   "<primaryValue> • <rules text with [n] dice inlined>"
  const desc =
    attr(html, /name="description" content="([^"]*)"/) ||
    attr(html, /property="og:description" content="([^"]*)"/) ||
    '';
  const [descValuePart, ...descRest] = desc.split(' • ');
  const rulesText = descRest.join(' • ').trim() || null;

  const primary = parsePrimaryValue(html);
  // Prefer the DOM-summed value; fall back to the bracketed meta value.
  if (primary.value == null) primary.value = sumBrackets(descValuePart);

  const image =
    attr(html, /<img class="card" src="([^"]+)"/) ||
    attr(html, /src="(\/assets\/cards\/[^"]+)"/);

  // Footer: "1ed · #92 · Common"  (rarity is the last segment)
  const footer = attr(
    html,
    /<div class="footer-details"[\s\S]*?<p[^>]*>\s*([^<]*1ed[\s\S]*?)<\/p>/
  );
  let rarity = null;
  if (footer) {
    const parts = stripTags(footer)
      .split('·')
      .map((s) => s.trim())
      .filter(Boolean);
    rarity = parts.length ? parts[parts.length - 1].toLowerCase() : null;
  }

  const artist = attr(
    html,
    /<p class="card-artist"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/
  );

  return {
    number,
    name,
    color: Number.isFinite(number) ? colorForNumber(number) : 'unknown',
    value: primary.value,
    dieColor: primary.dieColor,
    secondaryValue: parseAltValue(html),
    rarity,
    rulesText,
    artist: artist ? artist.trim() : null,
    image,
    set: '1ed',
  };
}
