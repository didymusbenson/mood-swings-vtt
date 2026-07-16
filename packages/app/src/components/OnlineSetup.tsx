import { StartScreen, type StartConfig } from './StartScreen.js';
import { JoinPanel } from './JoinPanel.js';

interface OnlineSetupProps {
  onHost: (config: StartConfig) => void;
  onJoin: (code: string, name: string) => void;
  onBack: () => void;
  initialCode?: string;
  /** The single shared name (lifted to App so it survives a trip to the Deckbuilder). */
  name: string;
  onName: (name: string) => void;
  /** Open the standalone Deckbuilder seeded with the current deck. */
  onOpenBuilder?: (deck: number[]) => void;
  /** A deck handed back from the Deckbuilder ("Use this deck") to pre-select. */
  initialDeck?: number[];
  /** Start a local goldfish game (Playtest) with the same name + deck. */
  onPlaytest?: (config: StartConfig) => void;
}

/**
 * The single "Host or Join" page. One shared name (used whether you host or join) drives
 * the create-game form (name + deck → "Create game") and, beneath it, the join box (room
 * code). Hosting uses the name for seat 1; joining sends it to the host.
 */
export function OnlineSetup({ onHost, onJoin, onBack, initialCode = '', name, onName, onOpenBuilder, initialDeck, onPlaytest }: OnlineSetupProps) {
  return (
    <StartScreen
      variant="host"
      name={name}
      onName={onName}
      onStart={onHost}
      onBack={onBack}
      onOpenBuilder={onOpenBuilder}
      initialDeck={initialDeck}
      onPlaytest={onPlaytest}
      footer={<JoinPanel name={name} onJoin={(code) => onJoin(code, name.trim() || 'Player 2')} initialCode={initialCode} />}
    />
  );
}
