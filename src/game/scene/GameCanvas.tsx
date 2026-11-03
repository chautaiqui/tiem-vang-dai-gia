import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping } from 'three';
import { HeldItem } from './HeldItem';
import { Customers } from './Npc';
import { Player } from './Player';
import { ShopScene } from './ShopScene';

export function GameCanvas() {
  return (
    <Canvas
      className="game-canvas"
      dpr={[1, 1.75]}
      camera={{ fov: 70, near: 0.05, far: 60 }}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, powerPreference: 'high-performance' }}
    >
      <ShopScene />
      <Customers />
      <HeldItem />
      <Player />
    </Canvas>
  );
}
