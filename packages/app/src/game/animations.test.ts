import { describe, expect, it } from 'vitest';
import type { GameState, LogEntry, PlayerState, ScoreBreakdown } from '@mood-swings/engine';
import { deriveCinematics, derivePassFlash } from './animations.js';

const players: PlayerState[] = [
  { id: 'p1', name: 'Alice', roundsWon: 0 },
  { id: 'p2', name: 'Bob', roundsWon: 0 },
];

// deriveCinematics only reads players/log/phase/round/winner/firstPlayer; the rest
// of GameState is irrelevant here, so we build a minimal fixture and cast.
function mk(overrides: Partial<GameState>): GameState {
  return {
    players,
    phase: 'awaitingPlay',
    round: 1,
    winner: null,
    firstPlayer: 'p1',
    log: [],
    ...overrides,
  } as GameState;
}

const scores: ScoreBreakdown[] = [
  { player: 'p1', playerName: 'Alice', total: 7, moods: [] },
  { player: 'p2', playerName: 'Bob', total: 4, moods: [] },
];

describe('deriveCinematics', () => {
  it('emits an opening round-start intro on first mount (prev = null)', () => {
    const state = mk({ round: 1, firstPlayer: 'p2', log: [{ round: 1, message: 'start', kind: 'round' }] });
    const cues = deriveCinematics(null, state);
    expect(cues).toEqual([{ kind: 'roundStart', round: 1, firstPlayerName: 'Bob' }]);
  });

  it('emits round-end then round-start across a scoring transition', () => {
    const prev = mk({ round: 1, log: [{ round: 1, message: 'Alice plays Glee', kind: 'play' }] });
    const scoringLog: LogEntry[] = [
      ...prev.log,
      { round: 1, message: 'Scoring — Alice 7, Bob 4', kind: 'score', scores },
      { round: 1, message: 'Alice wins round 1 (1/3)', kind: 'round', actor: 'p1' },
      { round: 2, message: 'Bob draws a card', kind: 'draw', actor: 'p2', private: 'p2' },
    ];
    const next = mk({ round: 2, firstPlayer: 'p1', log: scoringLog });

    const cues = deriveCinematics(prev, next);
    expect(cues).toEqual([
      { kind: 'roundEnd', round: 1, scores, winnerName: 'Alice' },
      { kind: 'roundStart', round: 2, firstPlayerName: 'Alice' },
    ]);
  });

  it('emits round-end then game-over on match point (no next round)', () => {
    const prev = mk({ round: 3, log: [{ round: 3, message: 'Bob plays', kind: 'play' }] });
    const next = mk({
      round: 3,
      phase: 'gameOver',
      winner: 'p1',
      log: [
        ...prev.log,
        { round: 3, message: 'Scoring — Alice 9, Bob 2', kind: 'score', scores },
        { round: 3, message: 'Alice wins round 3 (3/3)', kind: 'round', actor: 'p1' },
        { round: 3, message: 'Alice wins the game!', kind: 'game', actor: 'p1' },
      ],
    });

    const cues = deriveCinematics(prev, next);
    expect(cues).toEqual([
      { kind: 'roundEnd', round: 3, scores, winnerName: 'Alice' },
      { kind: 'gameOver', winnerName: 'Alice' },
    ]);
  });

  it('emits nothing for an ordinary play with no boundary crossing', () => {
    const prev = mk({ round: 1, log: [] });
    const next = mk({ round: 1, log: [{ round: 1, message: 'Alice plays Glee', kind: 'play' }] });
    expect(deriveCinematics(prev, next)).toEqual([]);
  });

  it('handles a skipped round (Awe): round advances with no score entry', () => {
    const prev = mk({ round: 1, log: [] });
    const next = mk({
      round: 2,
      log: [{ round: 1, message: 'No scoring this round — no one wins or loses', kind: 'round', actor: 'p1' }],
    });
    const cues = deriveCinematics(prev, next);
    expect(cues).toEqual([{ kind: 'roundStart', round: 2, firstPlayerName: 'p1' === next.firstPlayer ? 'Alice' : '' }]);
  });
});

describe('derivePassFlash', () => {
  it('returns the passing player name when a pass was logged', () => {
    const prev = mk({ log: [] });
    const next = mk({ log: [{ round: 1, message: 'Bob passes', kind: 'pass', actor: 'p2' }] });
    expect(derivePassFlash(prev, next)).toBe('Bob');
  });

  it('returns null when no pass was logged this transition', () => {
    const prev = mk({ log: [] });
    const next = mk({ log: [{ round: 1, message: 'Alice plays Glee', kind: 'play' }] });
    expect(derivePassFlash(prev, next)).toBeNull();
  });
});
