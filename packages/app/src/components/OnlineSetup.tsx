import { useState } from 'react';
import { StartScreen, type StartConfig } from './StartScreen.js';
import { JoinPanel } from './JoinPanel.js';

interface OnlineSetupProps {
  onHost: (config: StartConfig) => void;
  onJoin: (code: string, name: string) => void;
  onBack: () => void;
  initialCode?: string;
}

/**
 * The single "Host or Join" page. Owns ONE name (used whether you host or join), renders
 * the create-game form (name + shared deck → "Create game") and, beneath it, the join
 * box (just a room code). Hosting uses the name for seat 1; joining sends it to the host.
 */
export function OnlineSetup({ onHost, onJoin, onBack, initialCode = '' }: OnlineSetupProps) {
  const [name, setName] = useState('Player 1');
  return (
    <StartScreen
      variant="host"
      name={name}
      onName={setName}
      onStart={onHost}
      onBack={onBack}
      footer={<JoinPanel name={name} onJoin={(code) => onJoin(code, name.trim() || 'Player 2')} initialCode={initialCode} />}
    />
  );
}
