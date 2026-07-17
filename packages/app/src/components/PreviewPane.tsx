import { useState } from 'react';
import type { CardData, GameState, Mood, WouldBeChoices } from '@mood-swings/engine';
import { Card, DiceValue } from './Card.js';
import { handWouldBe, moodProvenance } from '../game/value.js';

export interface PreviewTarget {
  card: CardData;
  /** Present → this card is a mood in play; drives the game-state (top) region. */
  mood?: Mood;
  /** Live/computed value to headline (for moods in play). */
  value?: number;
  /**
   * Present → this is a playable hand card owned by this player; the top region
   * shows its objective would-be value (Value Transparency). Omitted for cards
   * merely being read.
   */
  handOwner?: string;
  /** Decision-modal selections, so a target-dependent would-be can resolve. */
  choices?: WouldBeChoices;
  /**
   * Force printed-only (no computed top region) — a card being READ, not acted
   * on: the discard inspector, a revealed card, info-only.
   */
  readOnly?: boolean;
}

/** Render rules text with the self-modifying clause wrapped in a highlight. */
function RulesText({ text, clause }: { text: string; clause?: string }) {
  if (!clause) return <>{text}</>;
  const at = text.indexOf(clause);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="preview__hl">{clause}</mark>
      {text.slice(at + clause.length)}
    </>
  );
}

/**
 * Fixed left-hand preview zone, styled as a taped index card / notebook page.
 *
 * Two stacked regions (Value Transparency):
 *   - TOP  — dynamic game-state details: for a mood in play, Controlled by /
 *            Current value (computed) / Modified by {cards}; for a playable hand
 *            card, its objective would-be value. Absent for read-only cards.
 *   - BOTTOM — the static printed-card details (color / value / secondary /
 *            rarity) and printed rules text, with the self-modifying clause
 *            highlighted when the mood's own text drives its value.
 */
export function PreviewPane({
  target,
  state,
  floating,
}: {
  target: PreviewTarget | null;
  state: GameState;
  /** Lift the pane above an open modal's scrim so it stays visible while reading. */
  floating?: boolean;
}) {
  // "View printed card": hide every app-added overlay (the computed value die on
  // the art, the would-be / computed region) so the clean printed scan shows.
  const [printedOnly, setPrintedOnly] = useState(false);
  return (
    <aside className={`preview${floating ? ' preview--floating' : ''}`} tabIndex={0} aria-label="Card preview">
      <span className="preview__tape preview__tape--l" aria-hidden />
      <span className="preview__tape preview__tape--r" aria-hidden />
      <div className="preview__head">
        <h3 className="preview__label">Card Preview</h3>
        {target && (
          <button
            type="button"
            className={`preview__toggle${printedOnly ? ' is-on' : ''}`}
            aria-pressed={printedOnly}
            onClick={() => setPrintedOnly((v) => !v)}
            title={printedOnly ? 'Show the computed value and details' : 'Hide overlays and show the printed card'}
          >
            {printedOnly ? 'Show details' : 'View printed card'}
          </button>
        )}
      </div>
      {target ? (
        <PreviewBody target={target} state={state} printedOnly={printedOnly} />
      ) : (
        <p className="preview__empty muted">Hover, focus, or drag a card to preview it here.</p>
      )}
    </aside>
  );
}

function PreviewBody({ target, state, printedOnly }: { target: PreviewTarget; state: GameState; printedOnly: boolean }) {
  const { card } = target;

  // --- Resolve the dynamic (top) region + the headline value/glow. ---
  const prov = target.mood && !target.readOnly ? moodProvenance(state, target.mood) : null;
  const wb =
    !target.mood && target.handOwner && !target.readOnly
      ? handWouldBe(state, target.handOwner, card.number, target.choices)
      : null;

  // Headline value shown on the big card + whether it renders the computed glow.
  let headline: number | undefined;
  let computed = false;
  if (prov) {
    headline = prov.current;
    computed = prov.computed;
  } else if (wb?.objective && wb.value != null) {
    headline = wb.value;
    computed = wb.computed;
  } else if (target.value != null) {
    headline = target.value;
  }

  const ownerName =
    target.mood && state.players.find((p) => p.id === target.mood!.owner)?.name;
  const selfClause = prov?.self?.clause;

  return (
    <div className="preview__body">
      <Card card={card} mood={target.mood} value={headline} computed={computed} large showArt plainArt={printedOnly} />

      {/* TOP — dynamic game-state details. Hidden in "View printed card" mode. */}
      {!printedOnly && (prov || (wb && wb.objective && wb.value != null)) && (
        <div className="preview__state">
          {prov ? (
            <>
              <dl className="preview__state-facts">
                <div>
                  <dt>Controlled by</dt>
                  <dd>{ownerName}</dd>
                </div>
                <div>
                  <dt>Current value</dt>
                  <dd className="preview__diceline">
                    <DiceValue value={prov.current} dieColor={card.dieColor} className="dice--mini" computed={prov.computed} />
                  </dd>
                </div>
              </dl>
              {prov.external.map((ext) => (
                <p key={ext.uid} className="preview__modby">
                  Modified by <strong>{ext.name}</strong>.
                </p>
              ))}
            </>
          ) : (
            <dl className="preview__state-facts">
              <div>
                <dt>Would-be value</dt>
                <dd className="preview__diceline">
                  <DiceValue value={wb!.value!} dieColor={card.dieColor} className="dice--mini" computed={wb!.computed} />
                  <span className="muted">if played now</span>
                </dd>
              </div>
            </dl>
          )}
        </div>
      )}

      {/* BOTTOM — static printed-card details. */}
      <dl className="preview__facts">
        <div>
          <dt>Color</dt>
          <dd className={`preview__color preview__color--${card.color}`}>{card.color}</dd>
        </div>
        <div>
          <dt>Value</dt>
          <dd className="preview__diceline">
            <DiceValue value={card.value} dieColor={card.dieColor} className="dice--mini" />
            <span className="muted">({card.dieColor} die)</span>
          </dd>
        </div>
        {card.secondaryValue && (
          <div>
            <dt>Secondary</dt>
            <dd className="preview__diceline">
              <DiceValue value={card.secondaryValue.value} dieColor={card.secondaryValue.dieColor} className="dice--mini" />
              <span className="muted">({card.secondaryValue.dieColor} die)</span>
            </dd>
          </div>
        )}
        <div>
          <dt>Rarity</dt>
          <dd className="preview__rarity">{card.rarity}</dd>
        </div>
      </dl>
      {card.rulesText && (
        <p className="preview__rules">
          <RulesText text={card.rulesText} clause={selfClause} />
        </p>
      )}
    </div>
  );
}
