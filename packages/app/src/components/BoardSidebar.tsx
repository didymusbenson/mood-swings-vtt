import { useEffect, useState } from 'react';
import type { GameState, LogEntry } from '@mood-swings/engine';
import { PreviewPane, type PreviewTarget } from './PreviewPane.js';
import { ActivityLog } from './ActivityLog.js';

type SidebarView = 'preview' | 'log';

/**
 * The single right-hand column shared by the card Preview and the Activity Log
 * (see docs/features/preview-log-update.md). The Preview is the column's resting
 * state — it fills the full column at all times when active, giving the
 * battlefield back the space the old dedicated left preview rail used to take.
 * The Log is a deliberate, opt-in detour reached via a tab, since everything it
 * records is already visible live on the board; it's a catch-up / diagnostic
 * tool, not something needed moment-to-moment, so it never shares space with the
 * Preview — switching tabs swaps the whole column.
 */
export function BoardSidebar({
  target,
  state,
  log,
  floating,
}: {
  target: PreviewTarget | null;
  state: GameState;
  log: LogEntry[];
  /** A targeting flow / discard inspector is open — the Preview is pinned. */
  floating: boolean;
}) {
  const [view, setView] = useState<SidebarView>('preview');

  // A targeting flow or the discard inspector needs the Preview (it lifts above
  // the modal scrim so the card being read stays visible and updates live). Pin
  // the column to Preview whenever one is open — and leave it there afterward:
  // Preview is the column's real job, so a forced interruption resets to it
  // rather than snapping back to a Log the player had merely wandered into.
  useEffect(() => {
    if (floating) setView('preview');
  }, [floating]);

  // While floating, the Preview is shown regardless of the selected tab.
  const active: SidebarView = floating ? 'preview' : view;

  return (
    <div className="sidebar">
      {!floating && (
        <div className="sidebar__tabs" role="tablist" aria-label="Side panel view">
          <button
            type="button"
            role="tab"
            aria-selected={active === 'preview'}
            className={`sidebar__tab ${active === 'preview' ? 'is-on' : ''}`}
            onClick={() => setView('preview')}
          >
            Preview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={active === 'log'}
            className={`sidebar__tab ${active === 'log' ? 'is-on' : ''}`}
            onClick={() => setView('log')}
          >
            Log
          </button>
        </div>
      )}
      <div className="sidebar__body">
        {active === 'preview' ? (
          <PreviewPane target={target} state={state} floating={floating} />
        ) : (
          <ActivityLog log={log} />
        )}
      </div>
    </div>
  );
}
