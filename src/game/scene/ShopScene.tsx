import { Environment, Lightformer } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { DoubleSide, type Group, type PointLight } from 'three';
import { useGame } from '../../stores/gameStore';
import { TEMPLATE_BY_ID, type Product } from '../logic/products';
import { GoldPiece } from './GoldPiece';
import { Interactable } from './Interactable';
import { npcPosition } from './registry';
import { floorTexture, priceBoardTexture, signTexture, streetTexture } from './textures';

/*
 * Layout (metres): shop spans x ∈ [-4, 4], z ∈ [-3, 3], ceiling at 3,2.
 * Back wall (z = -3): display cabinets + price board. Player works between
 * them and the counter (z ≈ -0,6). Customers stand in front; door at z = 3.
 */
const W = 8;
const D = 6;
const H = 3.2;

const WALL = '#f3e6cf';
const WOOD = '#6b3a1f';
const RED = '#a3141c';

function Glass({ args, ...props }: { args: [number, number, number] } & Omit<JSX.IntrinsicElements['mesh'], 'args'>) {
  return (
    <mesh {...props}>
      <boxGeometry args={args} />
      <meshPhysicalMaterial color="#dff3ff" transparent opacity={0.18} roughness={0.05} metalness={0} depthWrite={false} />
    </mesh>
  );
}

function Room() {
  const floor = useMemo(() => floorTexture(), []);
  const street = useMemo(() => streetTexture(), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={floor} roughness={0.35} />
      </mesh>
      {/* Raised floor behind the counter */}
      <mesh position={[0, 0.005, -1.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, 2.4]} />
        <meshStandardMaterial color="#8a5a34" roughness={0.6} />
      </mesh>
      <mesh position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#fbf6ec" />
      </mesh>
      {/* Walls */}
      <mesh position={[0, H / 2, -D / 2]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color={RED} roughness={0.8} />
      </mesh>
      <mesh position={[-W / 2, H / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial color={WALL} />
      </mesh>
      <mesh position={[W / 2, H / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial color={WALL} />
      </mesh>
      {/* Front wall: solid strip above, glass shop-front either side of the door */}
      <mesh position={[0, 2.75, D / 2]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[W, 0.9]} />
        <meshStandardMaterial color={WALL} side={DoubleSide} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 2.4, 0, D / 2]}>
          <mesh position={[0, 0.25, 0]}>
            <boxGeometry args={[3.2, 0.5, 0.12]} />
            <meshStandardMaterial color={WOOD} />
          </mesh>
          <Glass args={[3.2, 1.8, 0.03]} position={[0, 1.4, 0]} />
          <mesh position={[0, 2.3, 0]}>
            <boxGeometry args={[3.2, 0.06, 0.1]} />
            <meshStandardMaterial color="#c9a227" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* Street outside */}
      <mesh position={[0, 2.4, 9]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[26, 13]} />
        <meshBasicMaterial map={street} />
      </mesh>
      <mesh position={[0, -0.01, 6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 6]} />
        <meshStandardMaterial color="#9c9c9c" />
      </mesh>
    </group>
  );
}

function Door() {
  const leaf = useRef<Group>(null);
  useFrame((_, dt) => {
    if (!leaf.current) return;
    const near = Math.abs(npcPosition.z - 3) < 1.5 && Math.abs(npcPosition.x) < 1.6;
    const target = near ? -1.45 : 0;
    leaf.current.rotation.y += (target - leaf.current.rotation.y) * Math.min(1, dt * 4);
  });
  return (
    <Interactable target="door" position={[0, 0, D / 2]}>
      <mesh position={[-0.82, 1.15, 0]}>
        <boxGeometry args={[0.06, 2.3, 0.14]} />
        <meshStandardMaterial color="#c9a227" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0.82, 1.15, 0]}>
        <boxGeometry args={[0.06, 2.3, 0.14]} />
        <meshStandardMaterial color="#c9a227" metalness={0.8} roughness={0.3} />
      </mesh>
      <group ref={leaf} position={[-0.78, 0, 0]}>
        <Glass args={[1.56, 2.2, 0.04]} position={[0.78, 1.12, 0]} />
        <mesh position={[1.4, 1.1, -0.05]}>
          <boxGeometry args={[0.04, 0.5, 0.04]} />
          <meshStandardMaterial color="#c9a227" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
      {/* Hanging bell */}
      <mesh position={[0, 2.25, -0.15]}>
        <coneGeometry args={[0.06, 0.1, 12]} />
        <meshStandardMaterial color="#e2b13c" metalness={1} roughness={0.25} />
      </mesh>
    </Interactable>
  );
}

const SHELF_Y = [0.95, 1.4];

/** Places one gold piece per product on velvet trays, up to the slots available. */
function ShelfItems({ products, width }: { products: Product[]; width: number }) {
  const perShelf = 7;
  return (
    <>
      {SHELF_Y.map((y, row) => (
        <group key={y} position={[0, y, 0]}>
          <mesh position={[0, 0.01, 0]}>
            <boxGeometry args={[width - 0.2, 0.02, 0.32]} />
            <meshStandardMaterial color="#5a0b12" roughness={0.9} />
          </mesh>
          {products.slice(row * perShelf, row * perShelf + perShelf).map((p, i) => (
            <GoldPiece
              key={p.id}
              shape={TEMPLATE_BY_ID[p.templateId].shape}
              karat={p.karat}
              size={p.weightMg > 15000 ? 2.6 : 1.8}
              position={[-(width - 0.5) / 2 + (i * (width - 0.5)) / (perShelf - 1), 0.06, 0]}
            />
          ))}
        </group>
      ))}
    </>
  );
}

function Cabinets() {
  const products = useGame((s) => s.game?.products ?? []);
  const groups = useMemo(() => {
    const rings = products.filter((p) => p.karat === 'K24' && p.weightMg < 10000);
    const big = products.filter((p) => p.karat === 'K24' && p.weightMg >= 10000);
    const jewels = products.filter((p) => p.karat !== 'K24');
    return [rings, big, jewels];
  }, [products]);
  return (
    <Interactable target="cabinet">
      {[-2.5, 0, 2.5].map((x, i) => (
        <group key={x} position={[x, 0, -2.72]}>
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[2.2, 0.8, 0.5]} />
            <meshStandardMaterial color={WOOD} roughness={0.5} />
          </mesh>
          <mesh position={[0, 1.3, -0.24]}>
            <boxGeometry args={[2.2, 1.0, 0.02]} />
            <meshStandardMaterial color="#f7e7c1" metalness={0.3} roughness={0.4} />
          </mesh>
          <Glass args={[2.2, 1.0, 0.48]} position={[0, 1.3, 0]} />
          <mesh position={[0, 1.83, 0]}>
            <boxGeometry args={[2.24, 0.06, 0.52]} />
            <meshStandardMaterial color="#c9a227" metalness={0.8} roughness={0.3} />
          </mesh>
          <pointLight position={[0, 1.7, 0.1]} intensity={0.6} distance={1.4} color="#fff2cc" />
          <ShelfItems products={groups[i]} width={2.2} />
        </group>
      ))}
    </Interactable>
  );
}

function PriceBoard() {
  const prices = useGame((s) => s.game?.prices);
  const tex = useMemo(() => (prices ? priceBoardTexture(prices) : null), [prices]);
  if (!tex) return null;
  return (
    <Interactable target="board" position={[0, 2.45, -2.97]}>
      <mesh>
        <planeGeometry args={[2.9, 1.13]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[3.0, 1.23, 0.03]} />
        <meshStandardMaterial color="#c9a227" metalness={0.8} roughness={0.3} />
      </mesh>
    </Interactable>
  );
}

function Counter() {
  return (
    <group position={[0, 0, -0.6]}>
      {/* Base & glass top display */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[7, 0.7, 0.7]} />
        <meshStandardMaterial color={WOOD} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.36, 0.352]}>
        <planeGeometry args={[7, 0.12]} />
        <meshStandardMaterial color="#c9a227" metalness={0.8} roughness={0.3} />
      </mesh>
      <Glass args={[7, 0.3, 0.7]} position={[0, 0.85, 0]} />
      <mesh position={[0, 0.705, 0]}>
        <boxGeometry args={[6.9, 0.01, 0.66]} />
        <meshStandardMaterial color="#5a0b12" roughness={0.9} />
      </mesh>
      {[-3, -2.1, -0.3, 0.5, 2.2, 3.0].map((x, i) => (
        <GoldPiece key={x} shape={(['ring', 'bar-ring', 'chain', 'bracelet', 'bar-ring', 'pendant'] as const)[i]} karat={i % 2 ? 'K24' : 'K18'} size={1.8} position={[x, 0.74, 0]} />
      ))}
      <mesh position={[0, 1.005, 0]}>
        <boxGeometry args={[7.02, 0.01, 0.72]} />
        <meshPhysicalMaterial color="#e8f6ff" transparent opacity={0.3} roughness={0} />
      </mesh>
    </group>
  );
}

function Scale() {
  return (
    <Interactable target="scale" position={[-2.4, 1.01, -0.65]}>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.32, 0.08, 0.36]} />
        <meshStandardMaterial color="#e9e9e9" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.09, -0.04]}>
        <cylinderGeometry args={[0.1, 0.1, 0.01, 24]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Wind-shield box */}
      <Glass args={[0.28, 0.2, 0.26]} position={[0, 0.2, -0.04]} />
      <mesh position={[0, 0.06, 0.181]}>
        <planeGeometry args={[0.2, 0.05]} />
        <meshBasicMaterial color="#9cff9c" toneMapped={false} />
      </mesh>
    </Interactable>
  );
}

function InspectionKit() {
  return (
    <Interactable target="inspect" position={[-1.45, 1.01, -0.65]}>
      <mesh position={[0, 0.015, 0]}>
        <boxGeometry args={[0.5, 0.03, 0.3]} />
        <meshStandardMaterial color="#4b2a15" />
      </mesh>
      <mesh position={[-0.1, 0.04, 0]}>
        <boxGeometry args={[0.18, 0.02, 0.12]} />
        <meshStandardMaterial color="#111" roughness={0.9} />
      </mesh>
      {['#7fb3d5', '#82c29a', '#d98880'].map((c, i) => (
        <group key={c} position={[0.08 + i * 0.07, 0.07, 0]}>
          <mesh>
            <cylinderGeometry args={[0.022, 0.022, 0.08, 12]} />
            <meshStandardMaterial color={c} transparent opacity={0.85} />
          </mesh>
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.01, 0.012, 0.03, 8]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        </group>
      ))}
    </Interactable>
  );
}

function Pos() {
  return (
    <Interactable target="pos" position={[1.1, 1.01, -0.7]}>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.4, 0.06, 0.3]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0, 0.2, -0.08]} rotation={[-0.35, 0, 0]}>
        <boxGeometry args={[0.36, 0.24, 0.02]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0, 0.2, -0.068]} rotation={[-0.35, 0, 0]}>
        <planeGeometry args={[0.32, 0.2]} />
        <meshBasicMaterial color="#3fa9f5" toneMapped={false} />
      </mesh>
      {/* Receipt printer */}
      <mesh position={[0.34, 0.06, 0]}>
        <boxGeometry args={[0.18, 0.12, 0.2]} />
        <meshStandardMaterial color="#d8d8d8" />
      </mesh>
      <mesh position={[0.34, 0.13, 0.04]}>
        <boxGeometry args={[0.1, 0.01, 0.08]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
    </Interactable>
  );
}

function Safe() {
  return (
    <Interactable target="safe" position={[3.45, 0, -1.9]}>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.8, 1.2, 0.7]} />
        <meshStandardMaterial color="#3a3f45" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[-0.401, 0.75, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.03, 24]} />
        <meshStandardMaterial color="#c9a227" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[-0.41, 0.5, 0.15]}>
        <boxGeometry args={[0.03, 0.2, 0.03]} />
        <meshStandardMaterial color="#c9a227" metalness={0.9} roughness={0.2} />
      </mesh>
    </Interactable>
  );
}

function Decor() {
  const sign = useMemo(() => signTexture(), []);
  return (
    <group>
      {/* Sign above the door, facing in */}
      <mesh position={[0, 2.72, D / 2 - 0.02]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[4, 0.78]} />
        <meshBasicMaterial map={sign} toneMapped={false} />
      </mesh>
      {/* Thần Tài altar, low on the left wall */}
      <Interactable target="altar" position={[-3.75, 0, 2.3]}>
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[0.45, 0.6, 0.7]} />
          <meshStandardMaterial color={RED} />
        </mesh>
        <mesh position={[0, 0.8, 0]}>
          <boxGeometry args={[0.4, 0.4, 0.6]} />
          <meshStandardMaterial color="#7a0a10" />
        </mesh>
        <mesh position={[0.05, 0.72, 0]}>
          <sphereGeometry args={[0.07, 12, 10]} />
          <meshStandardMaterial color="#e2b13c" metalness={1} roughness={0.3} />
        </mesh>
        {[-0.2, 0.2].map((z) => (
          <mesh key={z} position={[0.12, 0.68, z]}>
            <cylinderGeometry args={[0.02, 0.02, 0.1, 8]} />
            <meshStandardMaterial color="#ff4d2e" emissive="#ff2a00" emissiveIntensity={2} />
          </mesh>
        ))}
        <pointLight position={[0.25, 0.8, 0]} intensity={0.4} distance={1.5} color="#ff5a2a" />
      </Interactable>
      {/* Waiting bench */}
      <group position={[-3.3, 0, 0.9]}>
        <mesh position={[0, 0.42, 0]}>
          <boxGeometry args={[0.5, 0.08, 1.4]} />
          <meshStandardMaterial color={WOOD} />
        </mesh>
        {[-0.6, 0.6].map((z) => (
          <mesh key={z} position={[0, 0.2, z]}>
            <boxGeometry args={[0.4, 0.4, 0.06]} />
            <meshStandardMaterial color="#4a2814" />
          </mesh>
        ))}
      </group>
      {/* Kumquat tree for Tết luck */}
      <group position={[3.35, 0, 2.3]}>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.25, 0.2, 0.4, 16]} />
          <meshStandardMaterial color="#b5651d" />
        </mesh>
        <mesh position={[0, 0.95, 0]}>
          <icosahedronGeometry args={[0.5, 1]} />
          <meshStandardMaterial color="#2f7d32" flatShading />
        </mesh>
        {Array.from({ length: 14 }, (_, i) => {
          const a = i * 2.4;
          const y = 0.7 + ((i * 37) % 50) / 100;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.45, y, Math.sin(a) * 0.45]}>
              <sphereGeometry args={[0.04, 8, 6]} />
              <meshStandardMaterial color="#ff8c1a" />
            </mesh>
          );
        })}
      </group>
      {/* Red lanterns */}
      {[-2.6, 2.6].map((x) => (
        <group key={x} position={[x, 2.75, 1.2]}>
          <mesh>
            <sphereGeometry args={[0.18, 14, 10]} />
            <meshStandardMaterial color="#d2141c" emissive="#7a0006" emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.005, 0.005, 0.3, 4]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Lighting() {
  const lit = useGame((s) => s.game?.phase !== 'morning');
  const main = useRef<PointLight[]>([]);
  useFrame((_, dt) => {
    for (const l of main.current) if (l) l.intensity += ((lit ? 9 : 0.6) - l.intensity) * Math.min(1, dt * 3);
  });
  return (
    <>
      <hemisphereLight args={['#fff6e6', '#5a3a22', lit ? 0.9 : 0.35]} />
      <ambientLight intensity={lit ? 0.35 : 0.15} />
      {[-2.5, 0, 2.5].map((x, i) => (
        <group key={x}>
          <pointLight ref={(l) => { if (l) main.current[i] = l; }} position={[x, 2.9, -0.8]} distance={7} decay={1.6} color="#fff1d6" />
          <mesh position={[x, H - 0.01, -0.8]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.22, 20]} />
            <meshBasicMaterial color={lit ? '#fffbe8' : '#888'} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <directionalLight position={[2, 6, 10]} intensity={0.8} color="#fff4e0" />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={3} color="#fff3d1" position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[8, 6, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#ffd27a" position={[0, 1.5, -5]} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={1} color="#b3141c" position={[-5, 1.5, 0]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="ring" intensity={2} color="#ffffff" position={[3, 3, 4]} scale={2} />
      </Environment>
    </>
  );
}

export function ShopScene() {
  return (
    <>
      <color attach="background" args={['#1a1210']} />
      <Lighting />
      <Room />
      <Door />
      <Cabinets />
      <PriceBoard />
      <Counter />
      <Scale />
      <InspectionKit />
      <Pos />
      <Safe />
      <Decor />
    </>
  );
}
