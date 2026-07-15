# Mood Swings v2 — Multiplayer Architecture Spec

Status: implementation-ready. Scope: add **Goldfish** (local hotseat, one driver) and **Host Game** (host-authoritative 2-player hidden-hand over WebRTC). **Vs Computer** is scaffolded only. Locked: PeerJS public broker, host-authoritative WebRTC, deploy this branch to Pages root at base `/mood-swings-vtt/`.

All file:line references are verified against the current tree (`App.tsx:30-44`, `usePlayInteraction.ts:187-194`, `choice-spec.ts:55-66` confirmed).

---

## 1. ARCHITECTURE OVERVIEW

### The model

There is exactly **one engine instance per match**, and it lives in exactly one browser: the host's. The engine (`Engine`, `App.tsx:9`) is the single authority that runs `engine.apply(state, action)` and holds the full unredacted `GameState`. Every seat is represented by a **`PlayerAgent`** — an abstraction over "where do this seat's actions come from, and where does its view go." A **`MatchRunner`** owns the engine, the seat→agent map, and the apply loop. Rendering is driven by a **redacted view** produced by `redactFor(state, viewer)`; a seat never renders raw `GameState` unless it is entitled to the whole thing (Goldfish).

Four concepts, four new files:

- `PlayerAgent` (action source + view sink) — `packages/app/src/net/agent.ts`
- `MatchRunner` (owns engine, routes actions, pushes views) — `packages/app/src/net/matchRunner.ts`
- `redactFor` (per-viewer state projection) — `packages/engine/src/redact.ts`
- `PeerTransport` (PeerJS host/joiner wire) — `packages/app/src/net/peer.ts`

### Data flow — Goldfish (one driver, both seats local)

```
Local human ──drag/click──> usePlayInteraction ──Action{player: me}──> MatchRunner.submit(action)
                                                                          │
                                                          engine.apply(state, action)  [App.tsx:36 moves here]
                                                                          │
                                                              setState(full GameState)  ← NO redaction
                                                                          │
                    GameBoard renders BOTH seats from raw state (unchanged, App.tsx:54)
```

`me = state.activePlayer` stays correct (`usePlayInteraction.ts:193`): whoever's turn it is drives. This is today's behavior, just re-parented under the runner. Zero redaction, zero transport.

### Data flow — Host (owns engine + drives seat 0)

```
HOST BROWSER                                              JOINER BROWSER
────────────                                              ──────────────
local human (seat p1)                                     local human (seat p2)
  │ Action{player:p1}                                       │ Action{player:p2}
  ▼                                                         ▼
MatchRunner.submit ──┐                          PeerTransport.send({t:'action', action})
  engine.apply       │  ◄─────────────── DataChannel ◄──────────┘
  │                  │
  ├─ redactFor(state,p1) ─► host GameBoard (own hand real, p2 hand hidden)
  └─ redactFor(state,p2) ─► DataChannel ─► {t:'state', view} ─► joiner setState ─► joiner GameBoard
```

Host is authoritative: the joiner **never** calls `engine.apply`. Joiner emits `Action` only; host validates (`engine.ts:390` checks `action.player === state.activePlayer` and re-checks legality), applies, then broadcasts a fresh redacted view to each seat. The joiner's `dispatch` is replaced by "send action, await next view" (Map 1, Seam A).

### Data flow — Joiner (thin client)

The joiner runs the same React tree, the same `GameBoard`, the same `usePlayInteraction`, but:
1. `state` is the **incoming redacted view**, set from a transport callback rather than local apply (Map 1, Seam B; `App.tsx:10`/`:54`).
2. `me` is pinned to the **local seat** (`p2`), not `state.activePlayer` — the one semantic change (§2).
3. Local seat is oriented to `bottom` (`GameBoard.tsx:799-800` — viewer-relative seating for the joiner).

The joiner needs the static `CardDB`/effects loaded locally (bundled via `index.ts:51` side-effect import) to render card art and compute its own legal moves via the public-board-only queries (`queries.ts:6-101`, none read `deck`/`seed`/opponent hands). Behavior/effects are never serialized — only data crosses the wire.

---

## 2. CORE ABSTRACTIONS

### `PlayerAgent` — the seat abstraction

`packages/app/src/net/agent.ts`

```ts
import type { Action, GameState, PlayerId } from '@mood-swings/engine';

/** A redacted (or full) projection of state for one viewer, plus who they are. */
export interface SeatView {
  seat: PlayerId;
  state: GameState;        // already redacted for `seat` (or full, for Goldfish)
  isLocalTurn: boolean;    // state.activePlayer === seat && state.phase === 'awaitingPlay'
}

/**
 * A seat's connection to the match. Every seat has one. The runner pushes views
 * TO the agent (pushView) and pulls actions FROM it (onAction).
 */
export interface PlayerAgent {
  readonly seat: PlayerId;
  readonly kind: 'localHuman' | 'remoteHuman' | 'computer';   // computer = deferred stub
  /** Runner calls this whenever a new authoritative view exists for this seat. */
  pushView(view: SeatView): void;
  /** Agent calls this callback to submit an action to the runner. Set by runner. */
  onAction: (action: Action) => void;
}
```

Three implementations:
- **`LocalHumanAgent`** (`agent.ts`) — `pushView` sets a React state that feeds `App`; `onAction` is the runner's `submit`. Used for Goldfish (both seats) and Host (seat 0) and Joiner (its own seat).
- **`RemoteHumanAgent`** (`peer.ts`) — `pushView` serializes `view.state` and sends `{t:'state'}` over the DataChannel; incoming `{t:'action'}` messages call `onAction`. Used host-side to represent the joiner's seat.
- **`ComputerAgent`** (`agent.ts`, deferred) — stub, §6.

### `MatchRunner` — owns the engine + apply loop

`packages/app/src/net/matchRunner.ts`

```ts
import { Engine, type Action, type GameState, type PlayerId } from '@mood-swings/engine';
import { redactFor } from '@mood-swings/engine/redact';
import type { PlayerAgent, SeatView } from './agent.js';

export interface MatchRunnerOpts {
  engine: Engine;
  initial: GameState;                 // from engine.setup(...)
  agents: Record<PlayerId, PlayerAgent>;
  /** Goldfish: one driver sees everything, so redaction is identity. */
  redact: boolean;
}

export class MatchRunner {
  private state: GameState;
  constructor(private opts: MatchRunnerOpts) {
    this.state = opts.initial;
    for (const seat of Object.keys(opts.agents) as PlayerId[]) {
      opts.agents[seat].onAction = (a) => this.submit(a);
    }
    this.broadcast();
  }

  /** Sole entry to the engine. Replaces App.tsx:36. Throws surface as errors. */
  submit(action: Action): void {
    const next = this.opts.engine.apply(this.state, action);  // host-authoritative
    this.state = next;
    this.broadcast();
  }

  private broadcast(): void {
    for (const seat of Object.keys(this.opts.agents) as PlayerId[]) {
      const view = this.opts.redact ? redactFor(this.state, seat) : this.state;
      const seatView: SeatView = {
        seat,
        state: view,
        isLocalTurn: this.state.activePlayer === seat && this.state.phase === 'awaitingPlay',
      };
      this.opts.agents[seat].pushView(seatView);
    }
  }
}
```

The runner is transport-agnostic. Goldfish, Host, and Joiner differ only in **which agents** are in the map and whether `redact` is on. On the joiner there is *no* MatchRunner and *no* engine — the joiner is a pure `PeerTransport` client whose incoming `{t:'state'}` drives `setState` directly (§3).

### `redactFor(state, viewer)` — per-viewer projection

`packages/engine/src/redact.ts` (engine package — pure, testable, no React). Derived directly from Map 2.

```ts
import type { GameState, PlayerId, CardNumber, LogEntry } from './types.js';

/** Opaque placeholder for a concealed hand/deck card. length is preserved. */
export const HIDDEN: CardNumber = -1 as CardNumber;

export function redactFor(state: GameState, viewer: PlayerId): GameState {
  const s = structuredClone(state);            // state is structuredClone-safe (Map 2 §4)

  // hands: keep viewer's; blank every other seat to same-length HIDDEN[] (types.ts:176)
  for (const pid of Object.keys(s.hands) as PlayerId[]) {
    if (pid !== viewer) s.hands[pid] = s.hands[pid].map(() => HIDDEN);
  }

  // deck: order is secret from everyone; keep only length (types.ts:172)
  s.deck = state.deck.map(() => HIDDEN);

  // seed: CRITICAL — predicts every future draw/shuffle. Zero it. (types.ts:237)
  s.seed = 0;

  // staged secret: next round's colour ban (Doubt #36) not yet active (types.ts:233)
  s.pendingBannedColors = [];

  // log: honour per-line concealment contract (types.ts:148-168)
  s.log = state.log.map((e) => redactLine(e, viewer));

  // moods, discard, roundScores, bannedColors, activePlayer, phase, players,
  // turnOrder, playedThisTurn, actedThisRound, playsRemaining, winner, etc.
  // are all PUBLIC board/flow state — pass through untouched (Map 2 §1).
  return s;
}

function redactLine(e: LogEntry, viewer: PlayerId): LogEntry {
  if (e.private && e.private !== viewer) {
    return { ...e, message: e.redacted ?? '', private: undefined, redacted: undefined };
  }
  return e;
}
```

Redaction contract (Map 2 §1): strip `hands[other]` → same-length `HIDDEN`; strip `deck` order; zero `seed`; drop `pendingBannedColors`; apply log `private/redacted`. Everything else is public board/flow and passes through. **Review guard:** `Mood.data` (`types.ts:78`) currently only holds `{playedRound}` (public) — if any future card stashes hidden info there, `redactFor` must scrub it; add a unit test asserting `Mood.data` keys stay in an allowlist.

Opponent hand **size** falls out of `HIDDEN[].length` for free; the `HandRow` renders `HIDDEN` cards as face-down at the existing `<Card disabled>` leak site (`GameBoard.tsx:233-260`) — so redaction *closes* today's leak with no GameBoard change.

### How `App.tsx` changes

Three surgical edits, all at the seams the maps identified:

1. **`App.tsx:9-10`** — `engine`/`state` move behind a session object. `App` gains `mode: 'menu'|'goldfish'|'host'|'join'` and `session: Session | null`. For Goldfish/Host, `session` wraps a `MatchRunner`; for Join, it wraps a `PeerTransport` client. `state` becomes "the local seat's current `SeatView.state`."

2. **`App.tsx:30-44` `dispatch`** → `dispatch = (a) => session.submitLocal(a)`. For Goldfish/Host this calls `MatchRunner.submit` (host runs engine). For Join it calls `PeerTransport.send({t:'action', action})` and does nothing else — the next `{t:'state'}` drives `setState` (Map 1 Seam A).

3. **`App.tsx:54`** — `<GameBoard state={view.state} onAction={dispatch} localSeat={session.localSeat} .../>`. `state` is now viewer-appropriate. `GameBoard` gains a `localSeat` prop threaded into `usePlayInteraction`.

Inside `usePlayInteraction.ts:193-194`, the only semantic change:

```ts
// was:  const me = state.activePlayer;  const canAct = state.phase === 'awaitingPlay';
const me = localSeat;                                          // viewer's seat, not active seat
const canAct = state.phase === 'awaitingPlay' && state.activePlayer === localSeat;
```

For Goldfish, `localSeat` is set to `state.activePlayer` each render (one driver = "me is whoever's turn it is"), preserving today's behavior with the same code path. The five action producers already stamp `player: me` (`usePlayInteraction.ts:237,278,293-299,460,476`) — no change needed there.

---

## 3. TRANSPORT — PeerJS host-authoritative

Add `peerjs` as an app **dependency** (Map 4 §4 — not present today; normal ESM, Vite bundles it, no `optimizeDeps.exclude`, connects to `0.peerjs.com` wss by absolute host so the `/mood-swings-vtt/` base is irrelevant). Secure context is satisfied by Pages HTTPS.

`packages/app/src/net/peer.ts`

### Room code + join flow

- Host creates `new Peer(roomCode)` where `roomCode` is a short generated id (e.g. 6 chars from a no-ambiguous-glyph alphabet, `generateRoomCode()`). The PeerJS broker registers that id.
- Joiner enters the code; `new Peer()` (random id) → `peer.connect(roomCode)` opens a `DataConnection` (the DataChannel).
- Join link (optional convenience): `#room=ABC123` in the URL **hash**, not a path segment (Map 4 §4 — Pages has no history fallback; hash/query only). `App` reads `location.hash` on load to prefill the join code.
- On `connection.on('open')`, host sends an initial `{t:'hello', seat:'p2'}` assigning the joiner its seat, immediately followed by the first `{t:'state'}` view.

### Message protocol

```ts
type NetMsg =
  | { t: 'hello'; seat: PlayerId }                 // host → joiner: your seat id
  | { t: 'state'; view: GameState }                // host → joiner: redacted view (JSON)
  | { t: 'action'; action: Action }                // joiner → host: submit
  | { t: 'error'; message: string }                // host → joiner: rejected action / illegal
  | { t: 'choice-request'; req: ChoiceRequest }    // host → joiner: your turn to sub-choose (§4)
  | { t: 'choice-response'; res: ChoiceResponse }; // joiner → host: sub-choice result (§4)
```

Wire format: `JSON.stringify`/`parse`. `GameState` and `Action` are JSON-safe (Map 2 §4 — all primitives/arrays/string-keyed records, no `Map`/`Set`/`Date`/class/function in state; `HIDDEN = -1` survives). Confirm `Choices` (in `effects.ts`) contains only uids/card-numbers/colors/player-ids before trusting `{t:'action'}` — Map 2 flagged it as the one action-path type not yet inspected; add a runtime `isSerializableChoices()` assert on the host receive path as a cheap guard.

### Host loop

```
on DataConnection message {t:'action'}:
    try { matchRunner.submit(msg.action) }        // engine validates player + legality (engine.ts:390)
    catch (e) { conn.send({t:'error', message: e.message}) }   // do NOT advance; joiner keeps last view
    // success path: MatchRunner.broadcast() already fired RemoteHumanAgent.pushView → {t:'state'}
```

`RemoteHumanAgent.pushView(view)` = `conn.send({t:'state', view: view.state})`. Host seat 0 is a `LocalHumanAgent` rendering `redactFor(state, 'p1')`.

### Joiner side

No engine, no runner. A thin `PeerClient`:
- `conn.on('data', msg)`:
  - `{t:'state'}` → `setView(msg.view)` → React `setState` → GameBoard re-renders. Satisfies the `useGameEvents` prev/next identity guard (`useGameEvents.ts:28`) because each incoming view is a fresh object — cinematics survive redaction unchanged (Map 1, "already-anticipated seam").
  - `{t:'error'}` → toast (reuse `App.tsx:59-66` error toast).
  - `{t:'hello'}` → set `localSeat`.
  - `{t:'choice-request'}` → open delegated-choice UI (§4).
- `dispatch(action)` = `conn.send({t:'action', action})`.

### Functional-not-perfect

No reconnection, no resume, no spectators, no lobby persistence. If the DataChannel drops, both sides show a "connection lost — start a new game" state (route back to the mode menu). One host, one joiner, one match. This is explicitly acceptable per the brief.

---

## 4. OPPONENT-CHOICE HANDLING

### The default rule

**The active player assembles ALL choices client-side before dispatch, and the engine applies the completed action** (project KEY SEAM; `usePlayInteraction.ts` `assembleChoices` at `:168-177`). This already works for the overwhelming majority of cards, and — critically — the engine already supports the active player picking cards *from a chosen opponent's hand*: `legalTargets` receives `{ players: flow.sel.players }` so a `cardsFrom:'chosen'` slot enumerates the chosen player's hand (`usePlayInteraction.ts:208-210`, `choice-spec.ts:55-66`).

So for the multiplayer case there are exactly two ways a choice can cross the hidden-hand boundary, and only the second needs new orchestration:

**Case 1 — active player legitimately sees the info (NO new work).** The engine reveals it, or the info is public. The active player assembles the whole action; `redactFor` still hides the rest. This covers all of Tier B, C, D, E from Map 3.

**Case 2 — the SUB-CHOICE belongs to the OTHER seat (needs MatchRunner orchestration, NO engine change).** The affected player must pick from *their own* hidden hand, and the active player must not see it until (or ever). This is Map 3 **Tier A**.

### Explicit per-card plan (from Map 3, cross-checked to card-notes.md)

**Delegate to the opponent seat — mid-turn choice hand-off (Tier A):**

| # | Card | Sub-choice owner | Concealment |
|---|------|------------------|-------------|
| 86 | Compulsion | victim picks a card from their hand to give | hidden hand — victim chooses (`card-notes.md:211`) |
| 31 | Confusion | **each** player picks a pass card simultaneously | hidden + simultaneous (`:228-232`) |
| 78 | Suspicion | **each** chosen player picks a discard simultaneously | hidden + simultaneous, no info before reveal (`:1061-66`) |
| 68 | Malice | chosen player picks which two of *their* moods | moods public; agency is delegated (`:769-773`) |
| 29 | Avoidance | **each** player picks own mood to pass, simultaneously | moods public; delegated + simultaneous (`:84-87`) |

**Engine-side reveal, active player only picks the target (Tier B — Case 1, no delegation):**

- **#33 Curiosity**, **#71 Paranoia** — active player picks the target; the *engine* does the random hidden-card reveal (`card-notes.md:294-298`, `:853-856`). The revealed identity then appears in a public `log` line, so `redactFor` must let that specific reveal line through to both viewers (it will — the reveal is written as a non-`private` public message; if the producer marks it `private`, drop that mark for reveals). **No delegation UI.**

**Tier C / E (Case 1 — active player decides, card injects/rotates into hidden hands):** #58 Condescension, #118 Fascination, #62 Cynicism, #49 Rationalization — active player assembles fully; the moved cards land in opponent hands and simply become `HIDDEN` in the opponent's next redacted view. **No delegation.**

**Tier D (~18 cards, public moods only):** #28, #48, #101, #76, #7, #91, #61, #43, #40, #50, #82, #100, #96, #56, #20, #22, #15, #107, #120, #51 etc. — trivially Case 1. **No delegation.**

### How the MatchRunner orchestrates delegation WITHOUT an engine change

The key insight: the engine takes **one fully-assembled `Action`**. For a Tier-A card, the runner collects the sub-choices from the correct seats *before* calling `engine.apply`, assembles them into the single `choices` object the engine already expects, then applies once. No engine change — the engine never knows two humans contributed.

Mechanism (`matchRunner.ts` gains a `pendingDelegation` path):

1. Active player plays a Tier-A card. `usePlayInteraction` recognizes the card needs a delegated slot (a small static set `DELEGATED_CARDS = {86, 31, 78, 68, 29}` in `net/delegation.ts`) and submits a **partial** action: everything the active player is entitled to choose (e.g. Compulsion's victim `players` slot), leaving the delegated slot empty.
2. `MatchRunner.submit` sees the card is in `DELEGATED_CARDS` and, instead of calling `engine.apply`, sends `{t:'choice-request', req}` to the seat(s) that must sub-choose. `ChoiceRequest` carries the card, the slot spec (`ChoiceSpec` slot), and, for the chooser only, their own real hand (they already have it in their view). The active player sees a "waiting for opponent" overlay.
3. Each targeted seat's client opens a minimal chooser (reuse the existing `TargetOverlay`/flow UI, `GameBoard.tsx:520-609`, scoped to the one slot) and returns `{t:'choice-response', res}` with the picked uid/card.
4. Runner merges responses into the `choices` object and now calls `engine.apply(state, fullAction)` **once**, then broadcasts. For **simultaneous** cards (#31 Confusion, #78 Suspicion, #29 Avoidance) the runner withholds `apply` until *all* responses are in — enforcing "no player sees another's pick before choosing" (`card-notes.md:232`, `:1065`, `:87`) because responses live only in host memory until the single atomic apply.

Goldfish note: in Goldfish there is one driver and both hands are visible, so delegation degrades to "the one human makes both sub-choices in sequence" — the runner detects `redact === false` and routes all `choice-request`s to the single local agent. No simultaneity concern (rules are unchanged; one person plays both seats, as in physical solo practice).

### Cards genuinely needing a USER RULING

- **#67 Intimidation** — **AMBIGUOUS, needs a ruling.** Map 3 flags it: the spec author modeled the *active* player choosing a card from the opponent's hand (label "Choose a card from their hand", `black.ts:78-84`), which in multiplayer would require exposing the opponent's hidden hand to the active seat. But `card-notes.md:724` says "that player reveals a card from their hand" without an explicit "chooses" delegation clause (contrast Compulsion `:211` "That player chooses"). **Decision required:** does the *opponent* choose which card to reveal (→ move #67 into Tier A / `DELEGATED_CARDS`), or does the *active* player choose (→ Case 1, but then the active player's redacted view must un-hide that opponent's hand for this one interaction — a targeted, temporary de-redaction, which is a leak surface worth avoiding). Recommended default pending the ruling: treat it as **opponent-chooses (Tier A)**, matching the "reveal a card" physical intuition and avoiding hand exposure — but confirm against the physical rules.

Everything else resolves under the default rule or the delegation mechanism with no further decisions.

---

## 5. GOLDFISH

Goldfish **is** today's hotseat, unchanged in rules, re-parented under the runner:

- One `MatchRunner` with `redact: false` and **two `LocalHumanAgent`s** (`p1`, `p2`), both wired to the same local UI.
- `localSeat` is set to `state.activePlayer` on each render, so `me` (`usePlayInteraction.ts:193`) resolves to the active seat exactly as today — one driver plays whoever's turn it is, both hands visible (the raw `state` flows to `GameBoard` at `App.tsx:54` with no redaction).
- No transport, no PeerJS, no delegation orchestration (all sub-choices go to the single local agent).

This is the safest first vertical slice: it exercises `MatchRunner` + `PlayerAgent` + the `App.tsx` refactor with **zero** behavioral change, so all 90 engine tests and the existing UI must pass identically. It's the regression guard for the whole refactor.

### Mode-chooser wiring

Hoist the chooser to `App.tsx` (Map 4 §3 — Join must route *around* StartScreen's deck UI, so the gate can't nest inside StartScreen). Add above the `state ? GameBoard : StartScreen` fork (`App.tsx:51-57`):

- `mode: 'menu' | 'goldfish' | 'host' | 'join'`, default `'menu'`.
- `menu` → render a new `<ModeChooser onPick={setMode}/>` (`components/ModeChooser.tsx`): three buttons — Goldfish, Host Game, Join Game.
- `goldfish` / `host` → render `<StartScreen onStart={...}/>` (`StartScreen.tsx:34`) unchanged — both need the full local `StartConfig` (`StartScreen.tsx:11-15`: players/deck/seed). The difference is only what `onStart` builds: Goldfish → `MatchRunner{redact:false, 2×LocalHumanAgent}`; Host → `MatchRunner{redact:true, LocalHumanAgent(p1) + RemoteHumanAgent(p2)}` plus `new Peer(roomCode)`.
- `join` → render `<JoinScreen/>` (`components/JoinScreen.tsx`, new): a single room-code input, no deck builder, no name inputs (the joiner receives redacted views and its seat via `{t:'hello'}`). On connect it becomes a `PeerClient` (§3).

`StartConfig` is unchanged. `seed` (`StartScreen.tsx:112`) already gives deterministic host-side setup, which is all host-authoritative needs (the joiner never replays).

---

## 6. VS COMPUTER (DEFERRED — scaffold only)

Leave exactly one thing: a `PlayerAgent` implementation stub so a future AI drops in without touching the runner, transport, or UI.

`packages/app/src/net/agent.ts`:

```ts
export class ComputerAgent implements PlayerAgent {
  readonly kind = 'computer' as const;
  constructor(readonly seat: PlayerId) {}
  onAction: (a: Action) => void = () => {};
  pushView(view: SeatView): void {
    if (!view.isLocalTurn) return;
    // DEFERRED: an AI brain would inspect view.state (already redacted to what
    // this seat may legally see) and call this.onAction(chosenAction).
    // No brain now. Intentionally does nothing → a Vs-Computer game started today
    // would stall on the AI's turn. Do NOT wire a "Vs Computer" menu button until
    // a brain exists.
    throw new Error('ComputerAgent has no brain yet (deferred)');
  }
}
```

Why this is enough (and correct) scaffolding:
- The AI seat consumes a **`SeatView`** — the same redacted projection a remote human gets. This forces the future brain to be fair-by-construction (it can't see the opponent's hand), and it means Vs-Computer is just `MatchRunner{redact:true, LocalHumanAgent(p1) + ComputerAgent(p2)}` — no transport at all.
- `onAction` is the identical submit path. When the brain lands, it calls `this.onAction(action)` from inside `pushView` (or an async tick) and everything downstream is already built.
- Delegation (§4) already routes `choice-request` by seat; a future brain answers `choice-request` the same way a remote human does.

Do **not** design action enumeration, evaluation, or difficulty now. Do not add the menu button. The abstraction is the deliverable.

---

## 7. DEPLOY

Two changes, one of them one-time and human-only.

**Code change — `.github/workflows/deploy-pages.yml:16`** (Map 4 §1). Current:

```yaml
on:
  push:
    branches: [main]      # line 16
  workflow_dispatch:
```

Change line 16 to deploy this branch to the live Pages root:

```yaml
    branches: [claude/v2-deployment-strategy-iorlce]
```

Nothing else in the workflow changes:
- **Base path**: leave it. `vite.config.ts:14-19` already defaults to `/mood-swings-vtt/` for builds. Do **not** set `VITE_BASE`.
- **Permissions** (`deploy-pages.yml:20-23`: `pages: write`, `id-token: write`) — already correct.
- **Concurrency** `group: pages` (`:27-29`) is global; main and this branch contend for the single deployment, which is fine because the plan is root-deploy this branch instead of merging.
- Build job unchanged: `npm ci` → `npm run build --workspace @mood-swings/app` (`:44-49`, which runs `tsc --noEmit && vite build`, `packages/app/package.json:8`) → upload `packages/app/dist` (`:54-57`). Adding `peerjs` as an app dependency requires no workflow change — Vite bundles it.

**One-time user setting (cannot be done from code):** GitHub repo → **Settings → Pages → Build and deployment → Source: "GitHub Actions"** (documented at `deploy-pages.yml:11-12`). Site URL: `https://didymusbenson.github.io/mood-swings-vtt/`. Also confirm the `github-pages` environment (`deploy-pages.yml:62-64`) has **no required-reviewers rule** that would gate a non-main branch. Until Source is set, `deploy-pages@v4` (`:66-68`) has nowhere to publish.

`workflow_dispatch` (`:17`) already lets this branch deploy manually **today** without the line-16 edit — usable to smoke-test the deploy before committing the trigger change.

---

## 8. BUILD PLAN

Ordered, dependency-aware. Each numbered item is a coherent commit. `[SEQ]` must precede what follows; `[PAR]` items in the same group are independent.

**Phase 0 — Shared foundation (all sequential; nothing else can start).**
1. `[SEQ]` Add `redactFor` + `HIDDEN` to `packages/engine/src/redact.ts` with unit tests (hands blanked to length, deck order stripped, seed zeroed, `pendingBannedColors` dropped, log `private/redacted` honoured, `Mood.data` allowlist). Pure engine, no UI. **Gate: engine tests still 90 green + new redaction tests.**
2. `[SEQ]` Add `PlayerAgent`/`SeatView` (`net/agent.ts`) + `LocalHumanAgent` + `MatchRunner` (`net/matchRunner.ts`). No transport yet.
3. `[SEQ]` Refactor `App.tsx` to route through `MatchRunner` for a **Goldfish-only** path (redact off, 2 local agents). Thread `localSeat` into `GameBoard`→`usePlayInteraction`; change `usePlayInteraction.ts:193-194` to `me = localSeat` / `canAct += activePlayer===localSeat`, with Goldfish setting `localSeat = state.activePlayer`. **Gate: full UI regression — behavior identical to pre-refactor hotseat.**

**Phase 1 — Goldfish + mode chooser (parallelizable after Phase 0).**
4. `[PAR]` `components/ModeChooser.tsx` + `App.tsx` mode gate (`App.tsx:51-57`). Wire Goldfish end-to-end. This is shippable on its own.
5. `[PAR]` `ComputerAgent` stub (`net/agent.ts`, §6) — trivial, no menu button. Independent.

**Phase 2 — Host/Join transport (sequential within, depends on Phase 0+1).**
6. `[SEQ]` Add `peerjs` app dependency. `net/peer.ts`: `PeerTransport`, `generateRoomCode`, `NetMsg` types, `RemoteHumanAgent`, `PeerClient` (joiner). JSON round-trip + `isSerializableChoices` guard.
7. `[SEQ]` Host path: `App.tsx` Host mode builds `MatchRunner{redact:true, LocalHumanAgent(p1)+RemoteHumanAgent(p2)}` + `new Peer(roomCode)`; wire `{t:'action'}`→submit, broadcast→`{t:'state'}`, errors→`{t:'error'}`.
8. `[SEQ]` Joiner path: `components/JoinScreen.tsx` + `PeerClient`; `{t:'state'}`→setView, `{t:'hello'}`→localSeat, `dispatch`→`{t:'action'}`; join-code hash prefill. **Gate: two browsers, a full 2-player game with only Tier-B/C/D cards (no delegation) played to a winner; verify no hand leak in joiner devtools.**

**Phase 3 — Opponent-choice delegation (depends on Phase 2).**
9. `[SEQ]` `net/delegation.ts` `DELEGATED_CARDS = {86,31,78,68,29}`; `ChoiceRequest`/`ChoiceResponse` types; `MatchRunner` pending-delegation path (partial action → `choice-request` → collect → single atomic `apply`), with the withhold-until-all-in rule for simultaneous #31/#78/#29.
10. `[SEQ]` Joiner-side delegated-choice UI (reuse `TargetOverlay`/flow scoped to one slot). **Gate: play each Tier-A card in a real 2-player game (§9).**
11. `[SEQ]` **Resolve the #67 Intimidation ruling** (§4/§10) and place it in Case 1 or `DELEGATED_CARDS` accordingly. Blocks Phase-3 acceptance for that one card only.

**Phase 4 — Deploy (independent of code phases; do last so the live root gets the finished build).**
12. `[PAR]` `deploy-pages.yml:16` branch edit (§7). User does the one-time Pages Source setting. Can be tested earlier via `workflow_dispatch`.

Parallelism summary: Phase 0 is a hard serial spine. Within Phase 1, tasks 4/5 are parallel. Phase 2 is serial (transport is inherently layered). Phase 3 is serial. Phase 4 can run any time but should *land* last.

---

## 9. VALIDATION

### Checklist
- [ ] `redactFor` unit tests: opponent `hands` are `HIDDEN[]` of correct length; `deck` order gone but length preserved; `seed === 0`; `pendingBannedColors === []`; log lines with `private !== viewer` show `redacted` (or empty); public fields (`moods`, `discard`, `roundScores`, `bannedColors`, `activePlayer`, `phase`, `playedThisTurn`) byte-identical.
- [ ] Joiner devtools inspection at every turn: `state.hands[opponent]` is all `HIDDEN`, `state.deck` is all `HIDDEN`, `state.seed === 0`, no `pendingBannedColors` content. **The primary hidden-hand leak site (`GameBoard.tsx:233-260`) renders opponent cards face-down.**
- [ ] Goldfish plays byte-for-byte like the old hotseat (regression); all 90 engine tests green; both hands visible; one driver.
- [ ] `me = localSeat` on the joiner: the joiner can only act on its own turn; `canAct` false when `activePlayer !== localSeat`; the five action producers stamp `player: localSeat`.
- [ ] Host validation: a hand-crafted illegal/spoofed `{t:'action'}` from the joiner is rejected by `engine.ts:390` and surfaces as `{t:'error'}`; host state does not advance; joiner keeps its last view.
- [ ] `JSON.stringify`/`parse` round-trips `GameState` and `Action` losslessly (no `undefined`/`Map`/`Set`; `HIDDEN=-1` survives); `Choices` passes `isSerializableChoices`.
- [ ] Cinematics/log animations play on the joiner from incoming views (`useGameEvents.ts:28` identity guard satisfied by fresh view objects).
- [ ] Seat orientation: joiner's own seat is pinned to `bottom` (`GameBoard.tsx:799-800`).
- [ ] Delegation atomicity: for #31/#78/#29 the host holds `apply` until all sub-choices arrive; no `{t:'state'}` reveals any player's pick before the single atomic apply.
- [ ] Deploy: `workflow_dispatch` from this branch publishes to `/mood-swings-vtt/`; join over the live HTTPS site (secure-context WebRTC) completes a game.

### Named cards for real 2-player acceptance tests
Chosen to stress hidden info, delegated choice, reveal plumbing, injection, and turn hand-off:

- **#86 Compulsion** — delegated pick from a hidden hand (victim chooses; hardest single-delegate).
- **#78 Suspicion** — multi-party **simultaneous** hidden-hand discard; verify no info leaks before the atomic reveal.
- **#31 Confusion** — every player simultaneously passes a hidden-hand card; verify simultaneity + redaction together.
- **#29 Avoidance** — simultaneous delegated pick over *public* moods; isolates delegation/simultaneity from concealment.
- **#67 Intimidation** — the ambiguous card; run it under whichever ruling is chosen and confirm no unintended opponent-hand exposure.
- **#33 Curiosity** (and/or **#71 Paranoia**) — engine random reveal of a hidden card; confirm the reveal line reaches BOTH viewers while the rest of the hand stays `HIDDEN`.
- **#62 Cynicism** — inject a public discard card into the opponent's hidden hand; confirm it becomes `HIDDEN` in the opponent's next view.
- **#49 Rationalization** — whole-hand rotation between seats; confirm each seat's post-rotation hand is correct locally and `HIDDEN` remotely.
- **#36 Doubt** — stages `pendingBannedColors`; confirm the opponent's view never shows the staged ban until it activates.

This list feeds the final `docs/multiplayer-implementation.md` acceptance suite.

---

## 10. RISKS / OPEN QUESTIONS

**Needs the user (one real decision):**
- **#67 Intimidation who-chooses ruling (§4).** The card note (`card-notes.md:724`) lacks an explicit delegation clause while the spec label implies the active player chooses. This is the only genuine gameplay-correctness fork. Recommended default: opponent-chooses (Tier A) to avoid exposing a hidden hand. **Confirm against physical rules before Phase 3 acceptance.**

**Technical risks (mitigable, no user decision):**
- **`Mood.data` leak channel** (`types.ts:78`). Currently only `{playedRound}` (public). If a future card stashes hidden info there, `redactFor` leaks it. Mitigation: allowlist test in Phase 0 that fails on unexpected `Mood.data` keys.
- **`Choices` serializability** (`effects.ts`, not yet inspected — Map 2 §4). If it ever holds a non-JSON value, `{t:'action'}` breaks silently. Mitigation: `isSerializableChoices` guard on host receive (Phase 2, task 6).
- **PeerJS public broker reliability.** The `0.peerjs.com` broker is best-effort and occasionally rate-limits/rejects ids. This is a locked decision; accept it for "functional-not-perfect." Mitigation: surface connect failures clearly and let the user retry with a new room code. No custom broker in scope.
- **No reconnection** (locked). A dropped DataChannel ends the match. Acceptable per brief; both sides route back to the mode menu.
- **Concurrency `group: pages`** means main and this branch share one Pages deployment (`deploy-pages.yml:27-29`). Fine given the root-deploy-this-branch plan, but a later push to `main` would clobber the live site. Note it; don't solve it.
- **Simultaneous-card correctness** (#31/#78/#29). The atomicity depends on the runner withholding `apply` until all `choice-response`s arrive. If any seat disconnects mid-collection, the turn is stuck — with no reconnection, this ends the match. Acceptable, but the delegation UI must show a clear "waiting/lost" state rather than hanging silently.
- **Deferred AI fairness is pre-guaranteed**: `ComputerAgent` consumes a redacted `SeatView`, so a future brain physically cannot see the opponent's hand. No risk to design now; noted so the brain author doesn't "helpfully" pass it raw state later.

No other decisions require the user — signaling and deploy are locked, and every remaining choice has a safe engineering default above.