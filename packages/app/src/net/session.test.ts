// Authority regression: in REAL multiplayer (networked Host/Join), a targeted /
// responding player must NOT be able to cancel or abort the INITIATOR's already-
// committed play. When it is your turn to answer a delegated sub-choice (e.g. the
// chosen player picking a card to give for Compulsion #86, or a card to discard for
// Suspicion #78), the only thing you can do is ANSWER — advancing the initiator's
// play — never rewind it back into their hand.
//
// (Goldfish's local single-driver Cancel is a DIFFERENT surface — the inline
// TargetOverlay in usePlayInteraction/GameBoard — and is intentionally left as-is.
// It never routes through these networked sessions, which is why it is out of scope
// here.)
//
// This test drives a real HostSession over a fake PeerJS transport and proves the
// responder (the joiner) has no message or method that reverts the held play.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Engine, type Action } from '@mood-swings/engine';
import { db } from '../game/db.js';
import type { NetMsg } from './peer.js';

// --- Fake PeerJS transport (hoisted so the vi.mock factory can see it) -------------
const { FakePeer, FakeConn, peers } = vi.hoisted(() => {
  type Handler = (...args: unknown[]) => void;
  const peers: FakePeer[] = [];

  class FakeConn {
    handlers = new Map<string, Handler>();
    sent: NetMsg[] = [];
    closed = false;
    on(ev: string, cb: Handler) {
      this.handlers.set(ev, cb);
      return this;
    }
    send(msg: NetMsg) {
      this.sent.push(msg);
    }
    close() {
      this.closed = true;
    }
    /** Test helper: simulate an inbound event from the remote peer. */
    fire(ev: string, ...args: unknown[]) {
      this.handlers.get(ev)?.(...args);
    }
  }

  class FakePeer {
    handlers = new Map<string, Handler>();
    lastConnect: FakeConn | null = null;
    constructor(public id?: string) {
      peers.push(this);
    }
    on(ev: string, cb: Handler) {
      this.handlers.set(ev, cb);
      return this;
    }
    connect() {
      this.lastConnect = new FakeConn();
      return this.lastConnect;
    }
    destroy() {}
    fire(ev: string, ...args: unknown[]) {
      this.handlers.get(ev)?.(...args);
    }
  }

  return { FakePeer, FakeConn, peers };
});

vi.mock('peerjs', () => ({ default: FakePeer }));

// Import AFTER the mock is registered.
import { HostSession, JoinSession } from './session.js';

/** Deck stacked so p1 (host) holds Compulsion #86; both seats get a full hand. */
function stackedDeck(): number[] {
  return [86, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
}

/** Bring a HostSession to an active match with a connected joiner. Returns the conn. */
function startedHost() {
  const engine = new Engine(db);
  const initial = engine.setup({
    players: [
      { id: 'p1', name: 'Host' },
      { id: 'p2', name: 'Bob' },
    ],
    deck: stackedDeck(),
    preshuffled: true,
  });
  const session = new HostSession(engine, initial, 'ABC123');
  const peer = peers.at(-1)!;
  const conn = new FakeConn();
  peer.fire('connection', conn); // joiner dials in
  conn.fire('data', { t: 'join', name: 'Bob' } satisfies NetMsg); // starts the match
  return { session, conn, initial };
}

beforeEach(() => {
  peers.length = 0;
});

describe('HostSession delegation authority — responder cannot abort the initiator play', () => {
  it('holds the initiator play, asks the responder, and offers NO abort path', () => {
    const { session, conn, initial } = startedHost();
    expect(session.status).toBe('active');
    const p2FirstCard = initial.hands.p2![0]!;

    // Host (initiator) plays Compulsion #86 targeting the joiner. The joiner must pick
    // a card from their own hand to give — a delegated sub-choice.
    const play: Action = { type: 'play', player: 'p1', card: 86, choices: { players: ['p2'] } };
    session.submit(play);

    // The play is now HELD by the host authority and the responder has been asked.
    expect(session.waitingForChoice).toBe(true);
    const requests = conn.sent.filter((m) => m.t === 'choice-request');
    expect(requests).toHaveLength(1);
    // Not applied yet: #86 is still in the host's hand (held, not committed to engine).
    expect(session.view!.hands.p1).toContain(86);

    // --- Responder abort attempts: NONE may revert or clear the held play. ---

    // (a) Spurious out-of-turn action (a "pass" to try to end the sub-choice). The
    // engine rejects it (not p2's turn); the held delegation is untouched.
    conn.sent.length = 0;
    conn.fire('data', { t: 'action', action: { type: 'pass', player: 'p2' } } satisfies NetMsg);
    expect(conn.sent.some((m) => m.t === 'error')).toBe(true); // rejected back to joiner
    expect(session.waitingForChoice).toBe(true);
    expect(session.view!.hands.p1).toContain(86); // still held, not reverted

    // (b) Spoofing the initiator's seat is refused outright.
    conn.sent.length = 0;
    conn.fire('data', {
      t: 'action',
      action: { type: 'play', player: 'p1', card: 1 },
    } satisfies NetMsg);
    expect(conn.sent.some((m) => m.t === 'error')).toBe(true);
    expect(session.waitingForChoice).toBe(true);
    expect(session.view!.hands.p1).toContain(86);

    // (c) There is simply no cancel/abort message in the protocol. An unknown message
    // type is ignored and changes nothing.
    conn.fire('data', { t: 'cancel' } as unknown as NetMsg);
    conn.fire('data', { t: 'abort' } as unknown as NetMsg);
    expect(session.waitingForChoice).toBe(true);
    expect(session.view!.hands.p1).toContain(86);

    // --- The ONLY resolution: the responder ANSWERS. That advances (commits) the
    // initiator's play; it never returns control to the initiator's hand. ---
    const req = requests[0]!.req;
    conn.fire('data', {
      t: 'choice-response',
      res: { id: req.id, seat: 'p2', choices: { cards: [p2FirstCard] } },
    } satisfies NetMsg);

    expect(session.waitingForChoice).toBe(false);
    // #86 was played (left the host's hand); the play committed, it did not rewind.
    expect(session.view!.hands.p1).not.toContain(86);
  });

  it('the host answering its OWN delegated slot also has only an answer path (no revert)', () => {
    // Sanity: HostSession.answerChoice only forwards the answer; there is no method on
    // the Session surface that a responder could call to abort a held play.
    const { session } = startedHost();
    const surface = Object.getOwnPropertyNames(Object.getPrototypeOf(session));
    expect(surface).toContain('answerChoice');
    expect(surface).toContain('submit');
    // No cancel/abort/revert affordance exists on the session responder surface.
    for (const name of surface) {
      expect(name).not.toMatch(/cancel|abort|revert|undo|rollback/i);
    }
  });
});

describe('JoinSession responder surface — the remote joiner cannot abort either', () => {
  it('receives a delegated request and can only answer it (sends a choice-response, never a cancel)', () => {
    const session = new JoinSession('ABC123', 'Bob');
    const peer = peers.at(-1)!;
    peer.fire('open'); // opens the DataConnection
    const conn = peer.lastConnect!;
    conn.fire('open'); // sends {t:'join'}

    // Host assigns our seat and pushes a redacted view.
    conn.fire('data', { t: 'hello', seat: 'p2' } satisfies NetMsg);

    // Host delegates a sub-choice to us (we are the responder).
    const req = {
      id: 'd0',
      card: 86,
      seat: 'p2' as const,
      slotIndex: 1,
      priorChoices: { players: ['p2'] },
      prompt: 'Choose a card from your hand to give them',
    };
    conn.fire('data', { t: 'choice-request', req } satisfies NetMsg);
    expect(session.pendingChoice).toEqual(req);

    // The ONLY responder action available is answerChoice → emits a choice-response.
    // There is no cancel/abort message and no method that reverts the initiator's play.
    conn.sent.length = 0;
    session.answerChoice({ cards: [5] });
    expect(conn.sent).toHaveLength(1);
    expect(conn.sent[0]!.t).toBe('choice-response');
    expect(session.pendingChoice).toBeNull();

    // No message the joiner can emit is an abort/cancel of the held play.
    for (const m of conn.sent) {
      expect(m.t).not.toMatch(/cancel|abort|revert/i);
    }
    const surface = Object.getOwnPropertyNames(Object.getPrototypeOf(session));
    for (const name of surface) {
      expect(name).not.toMatch(/cancel(?!Error)|abort|revert|undo|rollback/i);
    }
  });
});
