import { describe, expect, it } from 'vitest';
import type { LogEntry } from '@mood-swings/engine';
import { visibleMessage, kindStyle } from './log.js';

const draw: LogEntry = {
  round: 1,
  message: 'Alice draws Faith',
  kind: 'draw',
  actor: 'p1',
  private: 'p1',
  redacted: 'Alice draws a card',
};

describe('visibleMessage (per-viewer redaction)', () => {
  it('shows the full message in hotseat mode (no viewerId)', () => {
    expect(visibleMessage(draw)).toBe('Alice draws Faith');
  });

  it('shows the full message to the owning viewer', () => {
    expect(visibleMessage(draw, 'p1')).toBe('Alice draws Faith');
  });

  it('hides a private message from a non-owner viewer', () => {
    expect(visibleMessage(draw, 'p2')).toBe('Alice draws a card');
  });

  it('falls back to a generic placeholder when no redacted text is given', () => {
    const entry: LogEntry = { round: 1, message: 'secret', private: 'p1' };
    expect(visibleMessage(entry, 'p2')).toBe('(hidden)');
  });

  it('always shows non-private entries to anyone', () => {
    const entry: LogEntry = { round: 1, message: 'Bob passes', kind: 'pass', actor: 'p2' };
    expect(visibleMessage(entry, 'p1')).toBe('Bob passes');
  });
});

describe('kindStyle', () => {
  it('maps a known kind to an icon and accent', () => {
    expect(kindStyle('score').accent).toBe('good');
  });

  it('falls back to a neutral style for an unknown/missing kind', () => {
    expect(kindStyle(undefined).accent).toBe('neutral');
  });

  it('maps the reveal kind to a distinct icon and event accent', () => {
    const style = kindStyle('reveal');
    expect(style.accent).toBe('event');
    // The reveal icon must be distinct from every other kind's icon.
    const others = (['play', 'pass', 'draw', 'discard', 'return', 'bottomdeck', 'suppress', 'steal', 'give', 'score', 'round', 'game', 'info'] as const).map(
      (k) => kindStyle(k).icon,
    );
    expect(others).not.toContain(style.icon);
  });
});
