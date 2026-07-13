# Mood Swings — Virtual Tabletop

A virtual tabletop for playing **Mood Swings** (Mark Rosewater / Secret Lair, 2026).

- **v1 (MVP):** hotseat — two players on one screen, each with a hand, taking turns.
- **v2:** networked two-player with hidden hands.

## Where things are

| Path | What |
| --- | --- |
| [`REQUIREMENTS.md`](REQUIREMENTS.md) | Requirements, plan, architecture, open questions |
| [`docs/RULES.md`](docs/RULES.md) | Full extracted game rules (working reference) |
| [`data/card-index.json`](data/card-index.json) | All 135 cards: number, slug, name, color |
| [`data/cards.json`](data/cards.json) | Full card data — **not yet generated** (see Open Questions) |
| [`tools/`](tools/) | Card-data scraper + parser (see [`tools/README.md`](tools/README.md)) |

## Status

Planning + data tooling in place. Rules documented; card metadata captured. Next:
source the full card text/values (`data/cards.json`), then build the engine + app.
See the Open Questions in [`REQUIREMENTS.md`](REQUIREMENTS.md).
