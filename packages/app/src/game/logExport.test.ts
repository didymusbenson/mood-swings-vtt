import { describe, expect, it } from 'vitest';
import type { LogEntry } from '@mood-swings/engine';
import { formatLog, logFilename } from './logExport.js';

describe('formatLog', () => {
  it('groups entries by round with a header and indented messages', () => {
    const log: LogEntry[] = [
      { round: 1, message: 'Alice plays Charity', kind: 'play' },
      { round: 1, message: 'Bob draws a card', kind: 'draw' },
      { round: 2, message: 'Alice passes', kind: 'pass' },
    ];
    expect(formatLog(log)).toBe(
      [
        'Mood Swings — activity log',
        '',
        'Round 1',
        '  Alice plays Charity',
        '  Bob draws a card',
        '',
        'Round 2',
        '  Alice passes',
        '',
      ].join('\n'),
    );
  });

  it('expands a score entry into its per-player, per-mood breakdown', () => {
    const log: LogEntry[] = [
      {
        round: 1,
        message: 'Round 1 scored',
        kind: 'score',
        scores: [
          { player: 'p1', playerName: 'Alice', total: 7, moods: [{ name: 'Faith', value: 4 }, { name: 'Charity', value: 3 }] },
          { player: 'p2', playerName: 'Bob', total: 0, moods: [] },
        ],
      },
    ];
    expect(formatLog(log)).toBe(
      [
        'Mood Swings — activity log',
        '',
        'Round 1',
        '  Round 1 scored',
        '    Alice: 7',
        '      Faith = 4',
        '      Charity = 3',
        '    Bob: 0',
        '',
      ].join('\n'),
    );
  });

  it('round-trips a public reveal line into the exported transcript', () => {
    const log: LogEntry[] = [
      { round: 1, message: 'Bottom card revealed: Anger', kind: 'reveal' },
      { round: 1, message: 'Alice reveals Faith', kind: 'reveal', actor: 'p1' },
    ];
    expect(formatLog(log)).toBe(
      [
        'Mood Swings — activity log',
        '',
        'Round 1',
        '  Bottom card revealed: Anger',
        '  Alice reveals Faith',
        '',
      ].join('\n'),
    );
  });

  it('handles an empty log without throwing', () => {
    expect(formatLog([])).toBe('Mood Swings — activity log\n\n');
  });

  it('exposes a stable filename', () => {
    expect(logFilename()).toBe('mood-swings-log.txt');
  });
});
