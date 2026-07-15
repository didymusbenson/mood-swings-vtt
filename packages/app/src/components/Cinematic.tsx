import { useEffect } from 'react';
import type React from 'react';
import type { Cue, PassFlash } from '../game/animations.js';

/**
 * Auto-advance timing per cue (ms). `0` = stays until the player dismisses it.
 * Every cue is also click/Esc-to-continue, so these are ceilings, not waits — a
 * player who wants to move on never has to sit through the animation.
 */
const AUTO_MS: Record<Cue['kind'], number> = {
  roundStart: 2000,
  roundEnd: 3400,
  gameOver: 0, // the match is over — let it linger until dismissed
};

/**
 * A single full-screen cinematic: a dark scrim with fly-in text that settles at
 * centre (ease-in/out). Round-boundary + victory callouts derived from the log
 * (see game/animations.ts). Blocking but always skippable.
 */
export function Cinematic({ cue, onDismiss }: { cue: Cue; onDismiss: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    const ms = AUTO_MS[cue.kind];
    const timer = ms ? window.setTimeout(onDismiss, ms) : null;
    return () => {
      window.removeEventListener('keydown', onKey);
      if (timer) window.clearTimeout(timer);
    };
  }, [cue, onDismiss]);

  // Remount per cue (fresh key) so each one replays its enter animation.
  const key = `${cue.kind}-${cue.kind === 'gameOver' ? cue.winnerName : cue.round}`;

  return (
    <div
      className={`cinematic cinematic--${cue.kind}`}
      role="dialog"
      aria-modal="true"
      aria-live="assertive"
      onClick={onDismiss}
    >
      <div className="cinematic__scrim" />
      <div className="cinematic__stage" key={key}>
        {cue.kind === 'roundStart' && (
          <>
            <p className="cinematic__eyebrow">Round</p>
            <p className="cinematic__round">{cue.round}</p>
            <p className="cinematic__lead">
              <strong>{cue.firstPlayerName}</strong> plays first
            </p>
          </>
        )}

        {cue.kind === 'roundEnd' && (
          <>
            <p className="cinematic__eyebrow">Round {cue.round} — scoring</p>
            <div className="cinematic__tally">
              {cue.scores.map((s, i) => (
                <div
                  key={s.player}
                  className="cinematic__scoreline"
                  style={{ ['--d']: String(i) } as React.CSSProperties}
                >
                  <span className="cinematic__scorename">{s.playerName}</span>
                  <span className="cinematic__scorenum">{s.total}</span>
                </div>
              ))}
            </div>
            {cue.winnerName && (
              <p className="cinematic__winner">
                <strong>{cue.winnerName}</strong> takes the round
              </p>
            )}
          </>
        )}

        {cue.kind === 'gameOver' && (
          <>
            <p className="cinematic__eyebrow">Game over</p>
            <p className="cinematic__champion">{cue.winnerName}</p>
            <p className="cinematic__lead">wins the match!</p>
          </>
        )}

        <p className="cinematic__hint" aria-hidden>
          {cue.kind === 'gameOver' ? 'click to dismiss' : 'click to continue'}
        </p>
      </div>
    </div>
  );
}

/**
 * A brief, non-blocking flash when a player passes (no card played). Auto-clears;
 * keyed by `seq` so back-to-back passes retrigger it. Deliberately does not scrim
 * the board — a pass is a small beat, not a cinematic.
 */
export function PassIndicator({ flash, onDone }: { flash: PassFlash; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 1300);
    return () => window.clearTimeout(timer);
  }, [flash, onDone]);

  return (
    <div className="pass-flash" key={flash.seq} aria-live="polite">
      <span className="pass-flash__mark" aria-hidden>
        ⤼
      </span>
      <span className="pass-flash__text">
        <strong>{flash.name}</strong> passes
      </span>
    </div>
  );
}
