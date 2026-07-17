import { useEffect, useMemo, useRef, useState } from 'react';
import type { LogEntry, ScoreBreakdown } from '@mood-swings/engine';
import { kindStyle, visibleMessage } from '../game/log.js';
import { formatLog, logFilename } from '../game/logExport.js';

interface ActivityLogProps {
  log: LogEntry[];
  /**
   * Viewer for per-entry redaction. In the v1 hotseat (everything public) this
   * is omitted, so every message shows; a future per-seat client passes the
   * seated player's id to conceal opponents' private info.
   */
  viewerId?: string;
}

/** That round's collapsible per-mood score explanation (Value Transparency). */
function RoundScore({ scores }: { scores: ScoreBreakdown[] }) {
  return (
    <div className="log__score">
      {scores.map((s) => (
        <div key={s.player} className="log__score-player">
          <div className="log__score-head">
            <span className="log__score-name">{s.playerName}</span>
            <span className="log__score-total">{s.total}</span>
          </div>
          {s.moods.length === 0 ? (
            <p className="log__score-empty muted">No moods.</p>
          ) : (
            <ul className="log__score-moods">
              {s.moods.map((m, i) => (
                <li key={i} className="log__score-mood">
                  <span className="log__score-mood-name">{m.name}</span>
                  <span className="log__score-mood-val">{m.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Chat-style activity log: newest at the bottom, auto-scrolled into view,
 * subtly grouped by round and accented by kind. Each scored round carries a
 * per-mood score explanation — collapsed by default, expanded by clicking the
 * round header.
 */
export function ActivityLog({ log, viewerId }: ActivityLogProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  // Which rounds have their score explanation expanded (collapsed by default).
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // A round's score breakdown lives on its 'score' entry — index it by round so
  // the round header (rendered at the round's first entry) can reveal it.
  const scoreByRound = useMemo(() => {
    const map = new Map<number, ScoreBreakdown[]>();
    for (const e of log) {
      if (e.kind === 'score' && e.scores) map.set(e.round, e.scores);
    }
    return map;
  }, [log]);

  // On open (mount), jump to the newest entry.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On a new entry, follow the newest — but ONLY when the reader is already at
  // the bottom. The log is now a deliberately-opened read view, so scrolling
  // back through history shouldn't be yanked to the bottom when the opponent
  // acts mid-read.
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const nearBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 80;
    if (nearBottom) endRef.current?.scrollIntoView({ block: 'end' });
  }, [log.length]);

  const onExport = () => {
    const blob = new Blob([formatLog(log)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = logFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const toggle = (round: number) =>
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(round)) next.delete(round);
      else next.add(round);
      return next;
    });

  return (
    <div className="panel log">
      <div className="log__head">
        <h3>Activity log</h3>
        <button
          type="button"
          className="log__export"
          onClick={onExport}
          disabled={log.length === 0}
          title="Download the activity log as a text file"
        >
          ⭳ Export
        </button>
      </div>
      <div className="log__scroll" ref={scrollRef}>
        <ol className="log__list">
          {log.map((entry, i) => {
            const prev = log[i - 1];
            const newRound = !prev || prev.round !== entry.round;
            const style = kindStyle(entry.kind);
            const scores = scoreByRound.get(entry.round);
            const isOpen = expanded.has(entry.round);
            return (
              <li key={i} className="log__item">
                {newRound &&
                  (scores ? (
                    <>
                      <button
                        type="button"
                        className={`log__round-sep log__round-sep--btn ${isOpen ? 'is-open' : ''}`}
                        aria-expanded={isOpen}
                        onClick={() => toggle(entry.round)}
                      >
                        <span className="log__round-caret" aria-hidden>
                          {isOpen ? '▾' : '▸'}
                        </span>
                        <span>Round {entry.round}</span>
                      </button>
                      {isOpen && <RoundScore scores={scores} />}
                    </>
                  ) : (
                    <div className="log__round-sep" aria-hidden>
                      <span>Round {entry.round}</span>
                    </div>
                  ))}
                <div className={`log__entry log__entry--${style.accent}`}>
                  <span className="log__icon" aria-hidden>
                    {style.icon}
                  </span>
                  <span className="log__msg">{visibleMessage(entry, viewerId)}</span>
                </div>
              </li>
            );
          })}
        </ol>
        <div ref={endRef} />
      </div>
    </div>
  );
}
