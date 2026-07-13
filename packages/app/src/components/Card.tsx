import type React from 'react';
import type { CardData, Mood } from '@mood-swings/engine';
import { useCardImage } from '../hooks/useCardImage.js';

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
}

function dieLabel(v: number): string {
  // Values 7–12 are printed as two dice added together.
  if (v <= 6) return String(v);
  const a = 6;
  const b = v - 6;
  return `${a}+${b}`;
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
}: CardProps) {
  const { src, onError } = useCardImage(card);
  const headline = value ?? card.value;
  const suppressed = mood && mood.suppressed !== 'none';
  const secondaryActive = mood?.usingSecondary ?? false;

  const classes = [
    'card',
    `card--${card.color}`,
    compact ? 'card--compact' : '',
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
      <header className="card__head">
        <span className="card__name">{card.name}</span>
        <span className={`card__value card__value--${card.dieColor}`} title={`${card.dieColor} die`}>
          {dieLabel(headline)}
        </span>
      </header>

      {showArt && src ? (
        <div className="card__art">
          <img src={src} alt="" loading="lazy" onError={onError} />
        </div>
      ) : (
        <div className="card__art card__art--placeholder" aria-hidden>
          {card.name.charAt(0)}
        </div>
      )}

      {card.rulesText ? <p className="card__rules">{card.rulesText}</p> : <p className="card__rules card__rules--vanilla">—</p>}

      <footer className="card__foot">
        <span className="card__rarity">{card.rarity}</span>
        <span className="card__meta">
          {card.secondaryValue && (
            <span className={`card__secondary ${secondaryActive ? 'is-active' : ''}`} title="secondary value">
              alt {dieLabel(card.secondaryValue.value)}
            </span>
          )}
          {suppressed && <span className="card__flag">suppressed</span>}
          {secondaryActive && <span className="card__flag">flipped</span>}
        </span>
      </footer>
    </button>
  );
}
