import { useMemo, useState } from 'react';
import type { CardData, Color } from '@mood-swings/engine';
import { randomBoxDeck, validateCustomDeck, minDeckSize } from '@mood-swings/engine';
import { db } from '../game/db.js';
import { Card } from './Card.js';
import { Starburst } from './Starburst.js';
import { HowToPlay } from './HowToPlay.js';

export interface StartConfig {
  players: { id: string; name: string }[];
  deck: number[];
  seed: number;
}

interface StartScreenProps {
  onStart: (config: StartConfig) => void;
}

const COLOR_ORDER: Color[] = ['white', 'blue', 'black', 'red', 'green'];
const MIN = minDeckSize(2);

// Playable pool: every card except the headliner foil (#134) and the
// multiplayer-only helper Hurt Feelings (#135).
const POOL: CardData[] = db
  .all()
  .filter((c) => c.rarity !== 'headliner' && c.rarity !== 'helper')
  .sort((a, b) => a.number - b.number);

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

export function StartScreen({ onStart }: StartScreenProps) {
  const [p1, setP1] = useState('Player 1');
  const [p2, setP2] = useState('Player 2');
  const [tab, setTab] = useState<'random' | 'custom'>('random');
  const [showRules, setShowRules] = useState(false);

  const [seed, setSeed] = useState<number>(() => randomSeed());
  const [randomDeck, setRandomDeck] = useState<number[]>(() => randomBoxDeck(db, seed).deck);

  const [picked, setPicked] = useState<number[]>([]);

  const deck = tab === 'random' ? randomDeck : picked;
  const validation = useMemo(() => validateCustomDeck(deck, 2), [deck]);

  const byColor = useMemo(() => {
    const groups = new Map<Color, CardData[]>();
    for (const color of COLOR_ORDER) groups.set(color, []);
    for (const card of POOL) groups.get(card.color)?.push(card);
    return groups;
  }, []);

  const toggle = (n: number) =>
    setPicked((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

  const rerollRandom = () => {
    const s = randomSeed();
    setSeed(s);
    setRandomDeck(randomBoxDeck(db, s).deck);
  };

  const applySeed = (s: number) => {
    setSeed(s);
    setRandomDeck(randomBoxDeck(db, s).deck);
  };

  const canStart = validation.ok && p1.trim().length > 0 && p2.trim().length > 0;

  const start = () => {
    if (!canStart) return;
    onStart({
      players: [
        { id: 'p1', name: p1.trim() },
        { id: 'p2', name: p2.trim() },
      ],
      deck,
      seed,
    });
  };

  if (showRules) {
    return <HowToPlay onBack={() => setShowRules(false)} />;
  }

  return (
    <div className="start">
      <header className="start__header">
        <Starburst className="start__burst" label="1st Ed." />
        <h1>Mood Swings</h1>
        <p className="start__tag">Hotseat — two players, one screen</p>
        <button className="btn start__howto" onClick={() => setShowRules(true)}>
          How to Play
        </button>
      </header>

      <section className="panel">
        <h2>Players</h2>
        <div className="start__names">
          <label>
            Player 1
            <input value={p1} onChange={(e) => setP1(e.target.value)} />
          </label>
          <label>
            Player 2
            <input value={p2} onChange={(e) => setP2(e.target.value)} />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="tabs">
          <button className={tab === 'random' ? 'tab is-active' : 'tab'} onClick={() => setTab('random')}>
            Random deck
          </button>
          <button className={tab === 'custom' ? 'tab is-active' : 'tab'} onClick={() => setTab('custom')}>
            Deckbuilder
          </button>
        </div>

        {tab === 'random' ? (
          <div className="start__random">
            <p>Generates a 45-card Secret Lair box collation (23 C / 14 U / 6 R / 2 M).</p>
            <div className="start__seedrow">
              <label>
                Seed
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => applySeed(Number(e.target.value) || 0)}
                />
              </label>
              <button className="btn" onClick={rerollRandom}>
                Reroll
              </button>
              <span className="muted">{randomDeck.length} cards</span>
            </div>
          </div>
        ) : (
          <div className="start__builder">
            <p className="muted">
              Click cards to add or remove. Minimum {MIN} cards for 2 players.
            </p>
            {COLOR_ORDER.map((color) => (
              <div key={color} className="builder__group">
                <h3 className={`builder__color builder__color--${color}`}>{color}</h3>
                <div className="builder__cards">
                  {byColor.get(color)?.map((c) => (
                    <Card
                      key={c.number}
                      card={c}
                      compact
                      selected={picked.includes(c.number)}
                      onClick={() => toggle(c.number)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="start__foot panel">
        <div className="start__status">
          <strong>{deck.length}</strong> cards ·{' '}
          {validation.ok ? (
            <span className="ok">valid</span>
          ) : (
            <span className="bad">{validation.errors.join(' ')}</span>
          )}
        </div>
        <button className="btn btn--primary" disabled={!canStart} onClick={start}>
          Start game
        </button>
      </footer>
    </div>
  );
}
