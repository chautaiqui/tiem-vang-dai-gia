import { useEffect } from 'react';
import { Hud } from './components/hud/Hud';
import { Overlays } from './components/panels/Overlays';
import { TitleScreen } from './components/TitleScreen';
import { GameCanvas } from './game/scene/GameCanvas';
import { useGame } from './stores/gameStore';

export default function App() {
  const screen = useGame((s) => s.screen);
  const boot = useGame((s) => s.boot);
  useEffect(() => { void boot(); }, [boot]);

  if (screen === 'title') return <TitleScreen />;
  return (
    <div className="game-root">
      <GameCanvas />
      <Hud />
      <Overlays />
    </div>
  );
}
