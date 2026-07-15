import { useMemo, useState } from 'react';
import { legalTargets, specFor, type GameState, type PlayerId } from '@mood-swings/engine';
import { db } from '../game/db.js';
import { Card } from './Card.js';
import { maxPerChooser, type ChoiceRequest } from '../net/delegation.js';

interface DelegatedChoiceOverlayProps {
  request: ChoiceRequest;
  view: GameState;
  localSeat: PlayerId;
  onAnswer: (choices: { moods?: string[]; cards?: number[] }) => void;
}

const cardLookup = (n: number) => db.get(n);

/**
 * The picker a player sees when a card played by the OTHER player delegates a
 * sub-choice to them (Compulsion / Confusion / Suspicion / Malice / Avoidance) — or
 * when a simultaneous card asks them for their own pick. Self-contained (renders
 * candidates in the modal, not on the board) so it works identically on host and
 * joiner. The engine still validates the assembled action, so this is guidance UI.
 */
export function DelegatedChoiceOverlay({ request, view, localSeat, onAnswer }: DelegatedChoiceOverlayProps) {
  const spec = specFor(request.card);
  const slot = spec?.slots[request.slotIndex];
  const [picked, setPicked] = useState<Array<string | number>>([]);

  const max = slot ? maxPerChooser(request.card, slot.max) : 1;

  // Candidates for this slot, computed against the chooser's own view (their real hand
  // / their moods). For a mood slot we additionally restrict to the chooser's OWN moods
  // (some cards use from:'any' but mean "their own"); the engine filters by owner too.
  const candidates = useMemo(() => {
    if (!slot) return [];
    const legal = legalTargets(slot, view, localSeat, cardLookup, { players: request.priorChoices.players });
    if (slot.kind === 'mood') {
      const legalSet = new Set(legal.moods ?? []);
      return (view.moods[localSeat] ?? [])
        .filter((m) => legalSet.has(m.uid))
        .map((m) => ({ key: m.uid as string | number, card: db.get(m.copyOf ?? m.card), tag: 'mood' as const }));
    }
    if (slot.kind === 'handCard') {
      return (legal.cards ?? []).map((n) => ({ key: n as string | number, card: db.get(n), tag: 'card' as const }));
    }
    return [];
  }, [slot, view, localSeat, request.priorChoices.players]);

  if (!slot) return null;

  const toggle = (key: string | number) => {
    setPicked((cur) => {
      if (cur.includes(key)) return cur.filter((k) => k !== key);
      if (cur.length < max) return [...cur, key];
      if (max === 1) return [key];
      return cur;
    });
  };

  const confirm = () => {
    if (slot.kind === 'mood') onAnswer({ moods: picked.map(String) });
    else onAnswer({ cards: picked.map(Number) });
  };

  const noOptions = candidates.length === 0;

  return (
    <div className="delegate-overlay" role="dialog" aria-modal="true">
      <div className="delegate-panel">
        <h2 className="delegate-panel__title">{request.prompt}</h2>
        <p className="delegate-panel__sub">
          {noOptions
            ? 'You have nothing to choose here.'
            : max > 1
              ? `Choose up to ${max}.`
              : 'Choose one.'}
        </p>

        {!noOptions && (
          <div className="delegate-panel__cards">
            {candidates.map((c) => (
              <button
                key={c.key}
                type="button"
                className="delegate-card"
                onClick={() => toggle(c.key)}
                aria-pressed={picked.includes(c.key)}
              >
                <Card card={c.card} tile selected={picked.includes(c.key)} />
              </button>
            ))}
          </div>
        )}

        <div className="delegate-panel__actions">
          <button className="btn btn--primary" onClick={confirm} disabled={!noOptions && picked.length === 0}>
            {noOptions ? 'Continue' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
