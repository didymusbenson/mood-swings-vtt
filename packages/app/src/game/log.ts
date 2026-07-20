// Presentation helpers for the activity-log panel.
//
// The engine emits structured `LogEntry` values; the UI decides how to render
// them. `visibleMessage` implements the per-viewer redaction contract so v2 can
// conceal private information (a drawn card's identity, etc.) without any engine
// change; in the v1 hotseat no `viewerId` is passed, so everything shows.

import type { LogEntry, LogKind } from '@mood-swings/engine';

/**
 * The text a given viewer may see for an entry.
 *
 * If the entry is marked `private` to some player and the viewer is a *different*
 * player, the private `message` is hidden and `redacted` (or a generic
 * placeholder) is shown instead. With no `viewerId` (hotseat, everything
 * public) the full message always shows.
 */
export function visibleMessage(entry: LogEntry, viewerId?: string): string {
  if (entry.private && viewerId && viewerId !== entry.private) {
    return entry.redacted ?? '(hidden)';
  }
  return entry.message;
}

/** Small, non-noisy visual accent per log kind (icon + CSS accent class). */
export interface KindStyle {
  icon: string;
  /** Maps to a `.log__entry--<accent>` colour accent in styles.css. */
  accent: 'neutral' | 'good' | 'bad' | 'gain' | 'loss' | 'event';
}

const KIND_STYLES: Record<LogKind, KindStyle> = {
  play: { icon: '▸', accent: 'neutral' },
  pass: { icon: '⤼', accent: 'neutral' },
  draw: { icon: '↑', accent: 'gain' },
  discard: { icon: '✕', accent: 'loss' },
  return: { icon: '↩', accent: 'loss' },
  bottomdeck: { icon: '⬇', accent: 'loss' },
  reveal: { icon: '◎', accent: 'event' },
  suppress: { icon: '⊘', accent: 'bad' },
  steal: { icon: '⇄', accent: 'bad' },
  give: { icon: '⇦', accent: 'gain' },
  score: { icon: '★', accent: 'good' },
  round: { icon: '◆', accent: 'event' },
  game: { icon: '♛', accent: 'event' },
  info: { icon: '·', accent: 'neutral' },
};

const DEFAULT_STYLE: KindStyle = { icon: '·', accent: 'neutral' };

export function kindStyle(kind?: LogKind): KindStyle {
  return kind ? KIND_STYLES[kind] ?? DEFAULT_STYLE : DEFAULT_STYLE;
}
