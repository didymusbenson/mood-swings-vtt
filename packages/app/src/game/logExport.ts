// Serialise the activity log to plain text for the Log view's Export action.
//
// The log is a diagnostic / catch-up tool (see docs/features/preview-log-update.md):
// its two jobs are letting a player review what happened earlier in a match and
// exporting a trace for later debugging. `formatLog` turns the structured engine
// entries into a readable, round-grouped transcript; the component wraps it in a
// Blob download. Hotseat is fully public, so no per-viewer redaction is applied.

import type { LogEntry } from '@mood-swings/engine';

/**
 * A round-grouped plain-text transcript of the log. Score entries expand into
 * their per-player / per-mood breakdown (the same detail the log's expandable
 * round header shows) since that's exactly what a post-game review wants.
 */
export function formatLog(log: LogEntry[]): string {
  const lines: string[] = ['Mood Swings — activity log', ''];
  let lastRound: number | null = null;

  for (const entry of log) {
    if (entry.round !== lastRound) {
      if (lastRound !== null) lines.push('');
      lines.push(`Round ${entry.round}`);
      lastRound = entry.round;
    }
    lines.push(`  ${entry.message}`);
    if (entry.kind === 'score' && entry.scores) {
      for (const s of entry.scores) {
        lines.push(`    ${s.playerName}: ${s.total}`);
        for (const m of s.moods) {
          lines.push(`      ${m.name} = ${m.value}`);
        }
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

/** A stable, filesystem-safe filename for an exported log. */
export function logFilename(): string {
  return 'mood-swings-log.txt';
}
