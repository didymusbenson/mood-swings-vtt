import { useMemo, useState } from 'react';
import { randomBoxDeck, validateCustomDeck, minDeckSize } from '@mood-swings/engine';
import { db } from '../game/db.js';
import type { DeckCounts } from '../game/deckModel.js';
import { flatten, fromFlat, totalCards } from '../game/deckModel.js';
import { saveDeck } from '../game/deckStorage.js';
import { Starburst } from './Starburst.js';
import { HowToPlay } from './HowToPlay.js';
import { Deckbuilder } from './deckbuilder/Deckbuilder.js';

export interface StartConfig {
  players: { id: string; name: string }[];
  deck: number[];
  seed: number;
}

interface StartScreenProps {
  onStart: (config: StartConfig) => void;
}

const MIN = minDeckSize(2);

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

/** Value-equality for two deck count maps (same cards, same copies). */
function countsEqual(a: DeckCounts, b: DeckCounts): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

export function StartScreen({ onStart }: StartScreenProps) {
  const [p1, setP1] = useState('Player 1');
  const [p2, setP2] = useState('Player 2');
  const [tab, setTab] = useState<'random' | 'custom'>('random');
  const [showRules, setShowRules] = useState(false);

  const [seed, setSeed] = useState<number>(() => randomSeed());
  const [randomDeck, setRandomDeck] = useState<number[]>(() => randomBoxDeck(db, seed).deck);

  // Custom builder deck (a count map) + the last clean baseline for dirty tracking.
  const [builderCounts, setBuilderCounts] = useState<DeckCounts>(() => new Map());
  const [builderBaseline, setBuilderBaseline] = useState<DeckCounts>(() => new Map());
  const [builderName, setBuilderName] = useState('Untitled deck');
  const [guardOpen, setGuardOpen] = useState(false);

  const dirty = !countsEqual(builderCounts, builderBaseline);

  const deck = tab === 'random' ? randomDeck : flatten(builderCounts);
  const validation = useMemo(() => validateCustomDeck(deck, 2), [deck]);

  const rerollRandom = () => {
    const s = randomSeed();
    setSeed(s);
    setRandomDeck(randomBoxDeck(db, s).deck);
  };
  const applySeed = (s: number) => {
    setSeed(s);
    setRandomDeck(randomBoxDeck(db, s).deck);
  };

  const markClean = (counts: DeckCounts, name: string) => {
    setBuilderBaseline(new Map(counts));
    setBuilderName(name);
  };

  const viewInBuilder = () => {
    const counts = fromFlat(randomDeck);
    setBuilderCounts(counts);
    setBuilderBaseline(new Map(counts));
    setBuilderName('From random deck');
    setTab('custom');
  };

  /** Guarded tab switch: leaving an unsaved, dirty custom build prompts first. */
  const switchTab = (next: 'random' | 'custom') => {
    if (tab === 'custom' && next === 'random' && dirty) {
      setGuardOpen(true);
      return;
    }
    setTab(next);
  };

  const guardSave = () => {
    const name = window.prompt('Save deck as:', builderName)?.trim();
    if (!name) return; // stay in the guard
    saveDeck(name, builderCounts);
    markClean(builderCounts, name);
    setGuardOpen(false);
    setTab('random');
  };
  const guardDiscard = () => {
    setBuilderCounts(new Map(builderBaseline)); // revert to last clean
    setGuardOpen(false);
    setTab('random');
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
          <button className={tab === 'random' ? 'tab is-active' : 'tab'} onClick={() => switchTab('random')}>
            Random deck
          </button>
          <button className={tab === 'custom' ? 'tab is-active' : 'tab'} onClick={() => switchTab('custom')}>
            Deckbuilder
          </button>
        </div>

        {tab === 'random' ? (
          <div className="start__random">
            <p>Generates a 45-card Secret Lair box collation (23 C / 14 U / 6 R / 2 M).</p>
            <div className="start__seedrow">
              <label>
                Seed
                <input type="number" value={seed} onChange={(e) => applySeed(Number(e.target.value) || 0)} />
              </label>
              <button className="btn" onClick={rerollRandom}>
                Reroll
              </button>
              <button className="btn" onClick={viewInBuilder}>
                View in deckbuilder
              </button>
              <span className="muted">{randomDeck.length} cards</span>
            </div>
          </div>
        ) : (
          <Deckbuilder counts={builderCounts} db={db} onChange={setBuilderCounts} onClean={markClean} />
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
          {tab === 'custom' && <span className="muted"> · min {MIN}</span>}
        </div>
        <button className="btn btn--primary" disabled={!canStart} onClick={start}>
          Start game
        </button>
      </footer>

      {guardOpen && (
        <div className="dbx-modal__backdrop" onClick={() => setGuardOpen(false)} role="presentation">
          <div className="dbx-modal dbx-guard" role="dialog" aria-modal="true" aria-label="Unsaved changes" onClick={(e) => e.stopPropagation()}>
            <header className="dbx-modal__head">
              <h3 className="dbx-modal__title">Unsaved changes</h3>
            </header>
            <p>You have unsaved changes to this deck ({totalCards(builderCounts)} cards). Save them before leaving?</p>
            <div className="dbx-import__actions">
              <button type="button" className="btn btn--primary" onClick={guardSave}>Save deck</button>
              <button type="button" className="btn" onClick={guardDiscard}>Discard</button>
              <button type="button" className="btn" onClick={() => setGuardOpen(false)}>Keep editing</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
