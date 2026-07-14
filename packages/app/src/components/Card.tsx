import type React from 'react';
import { useState } from 'react';
import type { CardData, Mood } from '@mood-swings/engine';
import { useCardImage } from '../hooks/useCardImage.js';

/** The official printed card back, hotlinked (never committed — same policy as fronts). */
const CARD_BACK_URL = 'https://files.mtg.wiki/thumb/Mood_Swings_card_back.png/429px-Mood_Swings_card_back.png?20260609235227';

interface CardProps {
  card: CardData;
  /** When this card is a mood in play, its live/computed value & flags. */
  mood?: Mood;
  /** Live value to show as the headline number (falls back to printed value). */
  value?: number;
  onClick?: () => void;
  disabled?: boolean;
  /** Compact discard-pile / list rendering. */
  compact?: boolean;
  selected?: boolean;
  /** Show the card art layer (defaults to true). */
  showArt?: boolean;
  /** A legal target for the current targeting slot / drag. */
  highlighted?: boolean;
  /** Chosen as a target in the active targeting flow. */
  targetSelected?: boolean;
  /** Dimmed because it is not a valid drop while a drag is in progress. */
  dimmed?: boolean;
  /** Marks a hand card as pointer-draggable (grab cursor, no touch scroll). */
  pointerDraggable?: boolean;
  /** Pointer-drag start (see useHandDrag). */
  onPointerDown?: (e: React.PointerEvent) => void;
  /** Hover / focus for the left preview pane. */
  onPointerEnter?: () => void;
  onFocus?: () => void;
  /** Large, non-interactive rendering for the preview pane. */
  large?: boolean;
  /**
   * Compact board tile: coloured frame + name + value pip-die (or the art with
   * its die overlay) and NO rules text. The full rules live in the Previewer.
   */
  tile?: boolean;
  /** Render the sketch card back instead of the face (hidden hands, deck). */
  faceDown?: boolean;
}

type DieColor = 'white' | 'black';

/** Pip coordinates on a 100x100 die face for values 0..6. */
const PIP_LAYOUT: Record<number, Array<[number, number]>> = {
  0: [],
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 30], [70, 30], [30, 50], [70, 50], [30, 70], [70, 70]],
};

/** A single sketch pip-die (values 0..6). White die = light face; black die = dark face. */
export function Die({ value, dieColor, className }: { value: number; dieColor: DieColor; className?: string }) {
  const pips = PIP_LAYOUT[Math.max(0, Math.min(6, value))] ?? [];
  const isBlack = dieColor === 'black';
  const face = isBlack ? 'var(--die-black-face)' : 'var(--die-white-face)';
  const edge = isBlack ? 'var(--die-black-edge)' : 'var(--die-white-edge)';
  const pipFill = isBlack ? 'var(--die-white-face)' : 'var(--die-black-pip)';
  return (
    <svg
      className={`die die--${dieColor}${className ? ` ${className}` : ''}`}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${dieColor} die showing ${value}`}
    >
      {/* Hand-drawn rounded square: a second faint offset stroke fakes a sketchy edge. */}
      <rect x="8" y="8" width="84" height="84" rx="20" ry="20" fill={face} stroke={edge} strokeWidth="5" />
      <rect x="8" y="8" width="84" height="84" rx="20" ry="20" fill="none" stroke={edge} strokeWidth="1.5" opacity="0.5" transform="rotate(0.7 50 50)" />
      {pips.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="9" fill={pipFill} />
      ))}
    </svg>
  );
}

/**
 * Render a card value as one or two pip-dice. Printed values 7..12 show as two
 * dice added together (a 6 plus the remainder), matching the physical cards.
 */
export function DiceValue({ value, dieColor, className }: { value: number; dieColor: DieColor; className?: string }) {
  if (value > 6) {
    return (
      <span className={`dice${className ? ` ${className}` : ''}`}>
        <Die value={6} dieColor={dieColor} />
        <span className="dice__plus" aria-hidden>+</span>
        <Die value={value - 6} dieColor={dieColor} />
      </span>
    );
  }
  return (
    <span className={`dice${className ? ` ${className}` : ''}`}>
      <Die value={value} dieColor={dieColor} />
    </span>
  );
}

/**
 * The card back: the official printed back hotlinked from mtg.wiki; if it can't load
 * (offline, blocked CDN), fall back to the CSS/SVG homage (black frame, white centre,
 * wordmark, colour-wave corners) — mirroring how card fronts fall back to the frame.
 */
export function CardBack({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`cardback${className ? ` ${className}` : ''}`} aria-hidden>
      {!failed ? (
        <img className="cardback__img" src={CARD_BACK_URL} alt="" onError={() => setFailed(true)} />
      ) : (
        <>
          <svg className="cardback__waves" viewBox="0 0 120 168" preserveAspectRatio="none">
            {/* Colour-wave corner accents (four of the five card colours). */}
            <path d="M0 0 H48 Q30 20 46 40 Q26 54 40 78 L0 60 Z" fill="var(--c-blue)" opacity="0.9" />
            <path d="M120 0 H72 Q92 22 76 44 Q98 58 82 82 L120 62 Z" fill="var(--c-red)" opacity="0.9" />
            <path d="M0 168 H46 Q28 148 44 126 Q24 112 38 90 L0 108 Z" fill="var(--c-green)" opacity="0.9" />
            <path d="M120 168 H74 Q94 146 78 124 Q100 110 84 88 L120 106 Z" fill="var(--c-white)" opacity="0.9" />
          </svg>
          <div className="cardback__center">
            <span className="cardback__mark">Mood</span>
            <span className="cardback__mark cardback__mark--alt">Swings</span>
          </div>
        </>
      )}
    </div>
  );
}

/** The CSS/SVG fallback face — a recreation of the printed frame (no CDN art). */
function FallbackFace({ card, headline, mood }: { card: CardData; headline: number; mood?: Mood }) {
  const secondaryActive = mood?.usingSecondary ?? false;
  return (
    <>
      <header className="card__head">
        <span className="card__name">{card.name}</span>
        <span className="card__die" title={`${card.dieColor} die`}>
          <DiceValue value={headline} dieColor={card.dieColor} />
        </span>
      </header>

      <div className="card__art card__art--placeholder" aria-hidden>
        <svg className="card__doodle" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
          <path
            d="M8 46 Q20 14 34 32 Q42 44 52 24 Q62 6 74 30 Q82 46 92 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="26" cy="20" r="4" fill="currentColor" opacity="0.5" />
          <circle cx="70" cy="44" r="3" fill="currentColor" opacity="0.4" />
        </svg>
        <span className="card__monogram">{card.name.charAt(0)}</span>
      </div>

      {card.rulesText ? (
        <p className="card__rules">{card.rulesText}</p>
      ) : (
        <p className="card__rules card__rules--vanilla">—</p>
      )}

      <footer className="card__foot">
        <span className="card__rarity">{card.rarity}</span>
        <span className="card__meta">
          {card.secondaryValue && (
            <span className={`card__secondary ${secondaryActive ? 'is-active' : ''}`} title="secondary value">
              <span className="card__secondary-lbl">alt</span>
              <Die value={Math.min(6, card.secondaryValue.value)} dieColor={card.secondaryValue.dieColor} className="die--mini" />
            </span>
          )}
          {mood && mood.suppressed !== 'none' && <span className="card__flag">suppressed</span>}
          {secondaryActive && <span className="card__flag">flipped</span>}
        </span>
      </footer>
    </>
  );
}

/**
 * The compact board tile face: a mini frame carrying the card name + value
 * pip-die and a small doodle — no rules text (that lives in the Previewer).
 * Keeps the coloured frame border + pip-die so a tile still reads as a card.
 */
function TileFace({ card, headline, mood }: { card: CardData; headline: number; mood?: Mood }) {
  const secondaryActive = mood?.usingSecondary ?? false;
  const suppressed = mood && mood.suppressed !== 'none';
  return (
    <>
      <header className="card__head">
        <span className="card__name">{card.name}</span>
        <span className="card__die" title={`${card.dieColor} die`}>
          <DiceValue value={headline} dieColor={card.dieColor} />
        </span>
      </header>

      <div className="card__art card__art--placeholder card__art--tile" aria-hidden>
        <svg className="card__doodle" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
          <path
            d="M8 46 Q20 14 34 32 Q42 44 52 24 Q62 6 74 30 Q82 46 92 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
        <span className="card__monogram">{card.name.charAt(0)}</span>
      </div>

      {(suppressed || secondaryActive) && (
        <span className="card__tile-flags" aria-hidden>
          {suppressed && <span className="card__flag">suppressed</span>}
          {secondaryActive && <span className="card__flag">flipped</span>}
        </span>
      )}
    </>
  );
}

function dieLabel(v: number): string {
  if (v <= 6) return String(v);
  return `6+${v - 6}`;
}

export function Card({
  card,
  mood,
  value,
  onClick,
  disabled,
  compact,
  selected,
  showArt = true,
  highlighted,
  targetSelected,
  dimmed,
  pointerDraggable,
  onPointerDown,
  onPointerEnter,
  onFocus,
  large,
  tile,
  faceDown,
}: CardProps) {
  const { src, onError } = useCardImage(card);
  const headline = value ?? card.value;
  const suppressed = mood && mood.suppressed !== 'none';
  const secondaryActive = mood?.usingSecondary ?? false;
  const hasArt = showArt && !!src && !faceDown;

  const classes = [
    'card',
    `card--${card.color}`,
    hasArt ? 'card--art' : 'card--frame',
    faceDown ? 'card--back' : '',
    compact ? 'card--compact' : '',
    tile ? 'card--tile' : '',
    large ? 'card--large' : '',
    selected ? 'card--selected' : '',
    disabled ? 'card--disabled' : '',
    suppressed ? 'card--suppressed' : '',
    highlighted ? 'card--target' : '',
    targetSelected ? 'card--target-selected' : '',
    dimmed ? 'card--dimmed' : '',
    pointerDraggable ? 'card--draggable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const interactionProps = {
    onPointerDown,
    onPointerEnter,
    onFocus,
  };

  if (compact) {
    return (
      <button type="button" className={classes} onClick={onClick} disabled={disabled} title={card.rulesText ?? ''} {...interactionProps}>
        <span className="card__swatch" aria-hidden />
        <span className="card__compact-name">{card.name}</span>
        <span className="card__compact-value">{dieLabel(headline)}</span>
      </button>
    );
  }

  return (
    <button type="button" className={classes} onClick={onClick} disabled={disabled} {...interactionProps}>
      {faceDown ? (
        <CardBack />
      ) : hasArt ? (
        <div className="card__photo">
          <img src={src!} alt={card.name} loading="lazy" onError={onError} />
          {/* A pip-die overlay keeps the value legible even over the official art. */}
          <span className="card__die card__die--overlay" title={`${card.dieColor} die`}>
            <DiceValue value={headline} dieColor={card.dieColor} />
          </span>
          {suppressed && <span className="card__art-flag">suppressed</span>}
          {secondaryActive && <span className="card__art-flag card__art-flag--alt">flipped</span>}
        </div>
      ) : tile ? (
        <TileFace card={card} headline={headline} mood={mood} />
      ) : (
        <FallbackFace card={card} headline={headline} mood={mood} />
      )}
    </button>
  );
}
