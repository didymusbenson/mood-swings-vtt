import { useMemo, useState } from 'react';
import type React from 'react';
import { randomBoxDeck, validateCustomDeck, minDeckSize } from '@mood-swings/engine';
import { db } from '../game/db.js';
import { flatten } from '../game/deckModel.js';
import { listDecks, loadDeckCounts, type SavedDeck } from '../game/deckStorage.js';
import { PRESET_DECKS, presetFlat, presetById } from '../game/presetDecks.js';
import { Starburst } from './Starburst.js';
import { HowToPlay } from './HowToPlay.js';
import { ConfirmModal } from './Modal.js';

export interface StartConfig {
  players: { id: string; name: string }[];
  deck: number[];
  seed: number;
}

interface StartScreenProps {
  onStart: (config: StartConfig) => void;
  /** Optional: return to the mode chooser (v2). Omitted in single-mode contexts. */
  onBack?: () => void;
  /**
   * 'goldfish' (default): two local names, "Start game". 'host': one name (your own —
   * the joiner supplies theirs), "Create game", host tagline. The shared deck is always
   * configured here (there is one deck both players draw from).
   */
  variant?: 'goldfish' | 'host';
  /** Extra content rendered beneath the setup (the "join a game" panel in online mode). */
  footer?: React.ReactNode;
  /** Host variant: the single name, lifted so the join box can share it (one name field). */
  name?: string;
  onName?: (name: string) => void;
  /** Open the standalone Deckbuilder seeded with the given deck (Edit in Deckbuilder). */
  onOpenBuilder?: (deck: number[]) => void;
  /** A custom deck handed back from the Deckbuilder ("Use this deck") to pre-select. */
  initialDeck?: number[];
  /** Host variant: start a local goldfish game (Playtest) with the same name + deck. */
  onPlaytest?: (config: StartConfig) => void;
}

const MIN = minDeckSize(2);

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

function savedDeckSize(sd: SavedDeck): number {
  return Object.values(sd.cards).reduce((a, b) => a + b, 0);
}

export function StartScreen({ onStart, onBack, variant = 'goldfish', footer, name, onName, onOpenBuilder, initialDeck, onPlaytest }: StartScreenProps) {
  const isHost = variant === 'host';
  const [p1, setP1] = useState('Player 1');
  const [p2, setP2] = useState('Player 2');
  const [confirmPlaytest, setConfirmPlaytest] = useState(false);
  // Host variant can have its single name lifted (so the join box shares it).
  const controlled = isHost && name !== undefined && onName !== undefined;
  const p1Value = controlled ? name : p1;
  const setP1Value = controlled ? onName : setP1;
  const [tab, setTab] = useState<'random' | 'custom'>(initialDeck ? 'custom' : 'random');
  const [showRules, setShowRules] = useState(false);

  const [seed, setSeed] = useState<number>(() => randomSeed());
  const [randomDeck, setRandomDeck] = useState<number[]>(() => randomBoxDeck(db, seed).deck);

  // Custom deck for the game: a saved deck the user picked, or a deck handed back from
  // the Deckbuilder ("Use this deck"). Full editing lives on the standalone builder page.
  const [savedDecks] = useState<SavedDeck[]>(() => listDecks());
  const [savedId, setSavedId] = useState<string | null>(null);
  const [customDeck, setCustomDeck] = useState<number[] | null>(initialDeck ?? null);

  const deck = tab === 'random' ? randomDeck : customDeck ?? [];
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

  // Option values are namespaced so prebuilt-test-deck ids can't collide with a
  // user's saved-deck ids: `preset:<id>` vs the bare saved-deck id.
  const selectSaved = (value: string) => {
    if (!value) {
      setSavedId(null);
      setCustomDeck(null);
      return;
    }
    if (value.startsWith('preset:')) {
      const preset = presetById(value.slice('preset:'.length));
      if (!preset) return;
      setSavedId(value);
      setCustomDeck(presetFlat(preset));
      return;
    }
    const sd = savedDecks.find((d) => d.id === value);
    if (!sd) return;
    setSavedId(value);
    setCustomDeck(flatten(loadDeckCounts(sd).counts));
  };

  const canStart = validation.ok && p1Value.trim().length > 0 && (isHost || p2.trim().length > 0);

  const buildConfig = (p2Name: string): StartConfig => ({
    players: [
      { id: 'p1', name: p1Value.trim() },
      { id: 'p2', name: p2Name },
    ],
    deck,
    seed,
  });

  // Host: the joiner names themselves on connect, so seat 2 is just a placeholder here.
  const start = () => {
    if (canStart) onStart(buildConfig(isHost ? 'Opponent' : p2.trim()));
  };
  // Playtest = a local goldfish game; seat 2 is auto-named "Player 2".
  const startPlaytest = () => {
    if (canStart) onPlaytest?.(buildConfig('Player 2'));
  };

  if (showRules) {
    return <HowToPlay onBack={() => setShowRules(false)} />;
  }

  const header = (
    <header className="start__header">
      {onBack && (
        <button className="btn start__back" onClick={onBack}>
          ← Back
        </button>
      )}
      <Starburst className="start__burst" label="1st Ed." />
      <h1>Mood Swings</h1>
      <p className="start__tag">
        {isHost ? 'Host a friend, join a game, or playtest both sides' : 'Goldfish — two hands, one screen'}
      </p>
      <button className="btn start__howto" onClick={() => setShowRules(true)}>
        How to Play
      </button>
    </header>
  );

  // Deck tabs + content (Random deck / Custom deck). Shared by both variants. Full deck
  // editing lives on the standalone Deckbuilder page, reached via "Edit in Deckbuilder".
  const deckContent = (
    <>
      <div className="tabs">
        <button className={tab === 'random' ? 'tab is-active' : 'tab'} onClick={() => setTab('random')}>
          Random deck
        </button>
        <button className={tab === 'custom' ? 'tab is-active' : 'tab'} onClick={() => setTab('custom')}>
          Custom deck
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
            {onOpenBuilder && (
              <button className="btn" onClick={() => onOpenBuilder(randomDeck)}>
                Edit in Deckbuilder →
              </button>
            )}
            <span className="muted">{randomDeck.length} cards</span>
          </div>
        </div>
      ) : (
        <div className="start__custom">
          <label className="start__savedpick">
            Deck
            <select value={savedId ?? ''} onChange={(e) => selectSaved(e.target.value)}>
              <option value="">Choose a deck…</option>
              <optgroup label="Test decks (prebuilt)">
                {PRESET_DECKS.map((d) => (
                  <option key={d.id} value={`preset:${d.id}`} title={d.description}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
              {savedDecks.length > 0 && (
                <optgroup label="Saved decks">
                  {savedDecks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({savedDeckSize(d)})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <div className="start__customrow">
            <span className="muted">{customDeck ? `${customDeck.length} cards selected` : 'No deck selected'}</span>
            {onOpenBuilder && (
              <button className="btn" onClick={() => onOpenBuilder(customDeck ?? [])}>
                {customDeck ? 'Edit in Deckbuilder →' : 'Open Deckbuilder →'}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );

  const status = (
    <div className="start__status">
      <strong>{deck.length}</strong> cards ·{' '}
      {validation.ok ? (
        <span className="ok">valid</span>
      ) : (
        <span className="bad">{validation.errors.join(' ')}</span>
      )}
      {tab === 'custom' && <span className="muted"> · min {MIN}</span>}
    </div>
  );

  // ── Host / online variant ────────────────────────────────────────────────
  // A purpose-built lobby: one shared identity strip up top, then the two
  // mutually-exclusive choices side by side — HOST (configure the deck + create
  // a room) as the primary column, JOIN (a friend's code) as the compact
  // sidebar. Collapses to a single column on narrow screens.
  if (isHost) {
    return (
      <div className="start start--host">
        {header}

        <div className="host-lobby">
          <section className="panel host-you">
            <label className="host-you__field">
              <span className="host-you__lbl">Your name</span>
              <input value={p1Value} onChange={(e) => setP1Value(e.target.value)} />
            </label>
            <p className="host-you__note muted">Used whether you host a game or join a friend's.</p>
          </section>

          <section className="panel host-create">
            <div className="host-create__head">
              <span className="host-tag">Host</span>
              <div className="host-create__headtext">
                <h2>Start a game</h2>
                <p className="host-create__sub muted">Set the shared deck, then host a room to share — or playtest both sides yourself.</p>
              </div>
            </div>

            {deckContent}

            <div className="host-create__foot">
              {status}
              <div className="host-create__actions">
                <button className="btn btn--primary host-create__cta" disabled={!canStart} onClick={start}>
                  Host Game
                </button>
                {onPlaytest && (
                  <button
                    className="btn host-create__playtest"
                    disabled={!canStart}
                    onClick={() => setConfirmPlaytest(true)}
                    title="Play both sides yourself on this screen"
                  >
                    Playtest
                  </button>
                )}
              </div>
            </div>
          </section>

          <aside className="host-join">{footer}</aside>
        </div>

        {confirmPlaytest && (
          <ConfirmModal
            title="Playtest"
            message="Start a goldfish game testing both players?"
            confirmLabel="Start playtest"
            onConfirm={() => {
              setConfirmPlaytest(false);
              startPlaytest();
            }}
            onCancel={() => setConfirmPlaytest(false)}
          />
        )}
      </div>
    );
  }

  // ── Goldfish variant (unchanged) ─────────────────────────────────────────
  return (
    <div className="start">
      {header}

      <section className="panel">
        <h2>Players</h2>
        <div className="start__names">
          <label>
            Player 1
            <input value={p1Value} onChange={(e) => setP1Value(e.target.value)} />
          </label>
          <label>
            Player 2
            <input value={p2} onChange={(e) => setP2(e.target.value)} />
          </label>
        </div>
      </section>

      <section className="panel">{deckContent}</section>

      <footer className="start__foot panel">
        {status}
        <button className="btn btn--primary" disabled={!canStart} onClick={start}>
          Start game
        </button>
      </footer>

      {footer}    </div>
  );
}
