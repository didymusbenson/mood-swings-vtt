import { useCallback, useMemo, useState } from 'react';
import type { CardData } from '@mood-swings/engine';

const CDN_BASE = 'https://moodswings.scryfall.com';

/**
 * Resolve the art URL for a card. Returns `null` once the image has failed to
 * load so callers can fall back to the text face.
 *
 * This is the single choke-point for card art: a future step ("Scryfall CDN →
 * cache → local storage") can look up a cached data-URL here before falling
 * back to the network URL, without touching any component.
 */
export function useCardImage(card: CardData): {
  src: string | null;
  onError: () => void;
} {
  const [failed, setFailed] = useState(false);

  const networkSrc = useMemo(
    () => (card.image ? `${CDN_BASE}${card.image}` : null),
    [card.image],
  );

  const onError = useCallback(() => setFailed(true), []);

  return { src: failed ? null : networkSrc, onError };
}
