// WebRTC transport for Host Game, over PeerJS's public signalling broker.
//
// Host-authoritative model: the host's browser owns the engine (via MatchRunner);
// the joiner is a thin client that sends actions and receives redacted views. PeerJS
// only brokers the initial handshake (the "room code" is the host's peer id); once
// the DataConnection is open the two browsers talk directly and the broker is out of
// the loop. This is deliberately functional-not-perfect: one host, one joiner, one
// match, no reconnection.

import type { Action, GameState, PlayerId } from '@mood-swings/engine';
import type { PlayerAgent, SeatView } from './agent.js';
import type { ChoiceRequest, ChoiceResponse } from './delegation.js';

/** Messages exchanged over the DataChannel. JSON-encoded; must stay JSON-safe. */
export type NetMsg =
  | { t: 'hello'; seat: PlayerId } // host → joiner: the seat you are playing
  | { t: 'state'; view: GameState } // host → joiner: your redacted view
  | { t: 'action'; action: Action } // joiner → host: submit a play/pass
  | { t: 'error'; message: string } // host → joiner: your last action was rejected
  | { t: 'choice-request'; req: ChoiceRequest } // host → seat: make a delegated sub-choice
  | { t: 'choice-response'; res: ChoiceResponse }; // seat → host: the sub-choice result

/**
 * The seat the joiner always plays. The host is seat 0 (p1, plays first); the joiner
 * is seat 1 (p2). Fixed so both sides agree without negotiation.
 */
export const HOST_SEAT: PlayerId = 'p1';
export const JOINER_SEAT: PlayerId = 'p2';

/**
 * Namespace prefix for the peer id. The public PeerJS broker is a single global
 * id space shared with every other PeerJS app, so a bare 6-char code would collide;
 * prefixing makes squatting/collision with unrelated apps effectively impossible.
 * The user only ever sees/types the short code.
 */
export const ROOM_NAMESPACE = 'moodswings-vtt-v1';

/** Alphabet with no ambiguous glyphs (no 0/O, 1/I/L) — easy to read aloud/type. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** A short, human-friendly room code (the shareable part). */
export function generateRoomCode(len = 6): string {
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[buf[i]! % CODE_ALPHABET.length];
  return out;
}

/** The full peer id the broker registers, derived from the short code. */
export function roomPeerId(code: string): string {
  return `${ROOM_NAMESPACE}-${normaliseCode(code)}`;
}

/** Uppercase + strip spaces/hyphens so "abc 123" and "ABC-123" resolve alike. */
export function normaliseCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]/g, '');
}

/**
 * Runtime guard for a `Choices` object arriving over the wire (in a joiner's
 * `{t:'action'}`). The engine trusts action.choices; this rejects anything whose
 * known fields are the wrong shape before it reaches engine.apply, so a malformed
 * or hostile message can't crash the host with a weird value. Unknown extra keys are
 * ignored (the engine never reads them).
 */
export function isSerializableChoices(x: unknown): boolean {
  if (x == null) return true;
  if (typeof x !== 'object' || Array.isArray(x)) return false;
  const c = x as Record<string, unknown>;
  const okArr = (a: unknown, elem: 'string' | 'number') =>
    a === undefined || (Array.isArray(a) && a.every((v) => typeof v === elem));
  return (
    okArr(c.players, 'string') &&
    okArr(c.moods, 'string') &&
    okArr(c.cards, 'number') &&
    okArr(c.colors, 'string') &&
    (c.option === undefined || typeof c.option === 'string' || typeof c.option === 'number') &&
    (c.copy === undefined || typeof c.copy === 'number')
  );
}

/** Validate an inbound action from an untrusted peer before handing it to the engine. */
export function isValidInboundAction(x: unknown): x is Action {
  if (x == null || typeof x !== 'object') return false;
  const a = x as Record<string, unknown>;
  if (a.type === 'pass') return typeof a.player === 'string';
  if (a.type === 'play') {
    return (
      typeof a.player === 'string' &&
      typeof a.card === 'number' &&
      (a.from === undefined || a.from === 'hand' || a.from === 'discard') &&
      isSerializableChoices(a.choices)
    );
  }
  return false;
}

/**
 * Host-side stand-in for the networked joiner's seat. The MatchRunner treats it like
 * any other PlayerAgent: `pushView` sends the joiner its redacted view over the wire,
 * and inbound `{t:'action'}` messages are fed to `onAction` (wired up by HostSession).
 */
export class RemoteHumanAgent implements PlayerAgent {
  readonly kind = 'remoteHuman' as const;
  onAction: (action: Action) => void = () => {};
  constructor(
    readonly seat: PlayerId,
    private readonly send: (msg: NetMsg) => void,
  ) {}
  pushView(view: SeatView): void {
    this.send({ t: 'state', view: view.state });
  }
}
