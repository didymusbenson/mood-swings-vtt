import { useEffect, useRef } from 'react';
import type { LogEntry } from '@mood-swings/engine';
import { kindStyle, visibleMessage } from '../game/log.js';

interface ActivityLogProps {
  log: LogEntry[];
  /**
   * Viewer for per-entry redaction. In the v1 hotseat (everything public) this
   * is omitted, so every message shows; a future per-seat client passes the
   * seated player's id to conceal opponents' private info.
   */
  viewerId?: string;
}

/**
 * Chat-style activity log: newest at the bottom, auto-scrolled into view,
 * subtly grouped by round and accented by kind.
 */
export function ActivityLog({ log, viewerId }: ActivityLogProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [log.length]);

  return (
    <div className="panel log">
      <h3>Activity log</h3>
      <div className="log__scroll">
        <ol className="log__list">
          {log.map((entry, i) => {
            const prev = log[i - 1];
            const newRound = !prev || prev.round !== entry.round;
            const style = kindStyle(entry.kind);
            return (
              <li key={i} className="log__item">
                {newRound && (
                  <div className="log__round-sep" aria-hidden>
                    <span>Round {entry.round}</span>
                  </div>
                )}
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
