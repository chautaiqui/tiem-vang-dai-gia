import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { memo, useEffect, useRef } from 'react';
import { Vector3, type Group } from 'three';
import { useGame, type Stage } from '../../stores/gameStore';
import type { Appearance } from '../logic/customers';
import { Interactable } from './Interactable';
import { npcPosition } from './registry';

const SPAWN = new Vector3(0, 0, 5.4);
const PATHS: Record<'in' | 'out', Vector3[]> = {
  in: [new Vector3(0, 0, 2.3), new Vector3(0.55, 0, 0.4)],
  out: [new Vector3(0, 0, 2.3), new Vector3(0, 0, 5.6)],
};
const WALK_SPEED = 1.35;

/** Turn `from` toward `to` along the shortest arc. */
function turn(from: number, to: number, k: number): number {
  const d = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + d * k;
}

function Body({ look, legs, arms }: { look: Appearance; legs: React.RefObject<Group[]>; arms: React.RefObject<Group[]> }) {
  const h = look.height;
  const legLen = h * 0.47;
  const torso = h * 0.32;
  return (
    <group>
      {[-0.09, 0.09].map((x, i) => (
        <group key={x} position={[x, legLen, 0]} ref={(g) => { if (g && legs.current) legs.current[i] = g; }}>
          <mesh position={[0, -legLen / 2, 0]}>
            <boxGeometry args={[0.13, legLen, 0.15]} />
            <meshStandardMaterial color={look.pants} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, legLen + torso / 2, 0]}>
        <boxGeometry args={[0.38, torso, 0.22]} />
        <meshStandardMaterial color={look.shirt} />
      </mesh>
      {[-0.25, 0.25].map((x, i) => (
        <group key={x} position={[x, legLen + torso - 0.03, 0]} ref={(g) => { if (g && arms.current) arms.current[i] = g; }}>
          <mesh position={[0, -torso * 0.45, 0]}>
            <boxGeometry args={[0.1, torso * 0.9, 0.12]} />
            <meshStandardMaterial color={look.shirt} />
          </mesh>
          <mesh position={[0, -torso * 0.95, 0]}>
            <sphereGeometry args={[0.05, 8, 6]} />
            <meshStandardMaterial color={look.skin} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, legLen + torso + 0.04, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.08, 8]} />
        <meshStandardMaterial color={look.skin} />
      </mesh>
      <mesh position={[0, h - 0.11, 0]}>
        <sphereGeometry args={[0.11, 14, 12]} />
        <meshStandardMaterial color={look.skin} />
      </mesh>
      <mesh position={[0, h - 0.07, -0.015]} scale={[1.05, 0.85, 1.05]}>
        <sphereGeometry args={[0.112, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
        <meshStandardMaterial color={look.hair} />
      </mesh>
      {/* Eyes face +z in local space */}
      {[-0.04, 0.04].map((x) => (
        <mesh key={x} position={[x, h - 0.1, 0.1]}>
          <sphereGeometry args={[0.014, 6, 6]} />
          <meshBasicMaterial color="#1a1a1a" />
        </mesh>
      ))}
    </group>
  );
}

function Person({ look, walking }: { look: Appearance; walking: React.MutableRefObject<boolean> }) {
  const legs = useRef<Group[]>([]);
  const arms = useRef<Group[]>([]);
  useFrame(() => {
    const t = performance.now() / 1000;
    const swing = walking.current ? Math.sin(t * 8) * 0.5 : 0;
    legs.current.forEach((g, i) => g && (g.rotation.x = i ? swing : -swing));
    arms.current.forEach((g, i) => g && (g.rotation.x = i ? -swing * 0.7 : swing * 0.7));
  });
  return <Body look={look} legs={legs} arms={arms} />;
}

const NpcActor = memo(function NpcActor({ look, stage, name, patience }: { look: Appearance; stage: Stage; name: string; patience: number }) {
  const root = useRef<Group>(null);
  const waypoint = useRef(0);
  const walking = useRef(true);
  const arrived = useRef(false);

  useEffect(() => {
    if (stage === 'leaving') {
      waypoint.current = 0;
      walking.current = true;
      arrived.current = false;
    }
  }, [stage]);

  useEffect(() => () => void npcPosition.set(0, 0, 9), []);

  useFrame((_, dtRaw) => {
    const g = root.current;
    if (!g) return;
    const dt = Math.min(dtRaw, 0.05);
    const path = stage === 'leaving' ? PATHS.out : PATHS.in;
    if (!arrived.current) {
      const target = path[waypoint.current];
      const dir = target.clone().sub(g.position);
      const dist = dir.length();
      if (dist < 0.05) {
        waypoint.current++;
        if (waypoint.current >= path.length) {
          arrived.current = true;
          walking.current = false;
          const s = useGame.getState();
          if (stage === 'leaving') s.npcLeft();
          else s.npcArrived();
        }
      } else {
        dir.normalize();
        g.position.addScaledVector(dir, Math.min(dist, WALK_SPEED * dt));
        const yaw = Math.atan2(dir.x, dir.z);
        g.rotation.y = turn(g.rotation.y, yaw, Math.min(1, dt * 8));
      }
    } else if (stage !== 'leaving') {
      // Face the counter (toward −z), sway a little while waiting.
      g.rotation.y = turn(g.rotation.y, Math.PI, Math.min(1, dt * 4));
      g.position.y = Math.sin(performance.now() / 600) * 0.005;
    }
    npcPosition.copy(g.position);
  });

  const mood = patience > 60 ? '#3ecf6e' : patience > 30 ? '#f2b632' : '#e5484d';
  return (
    <group ref={root} position={SPAWN.toArray()}>
      <Interactable target="customer">
        <Person look={look} walking={walking} />
        {look.companion && (
          <group position={[0.5, 0, 0.1]}>
            <Person look={{ ...look, shirt: '#c2577a', pants: '#e8e1d8', height: look.height - 0.1, hair: '#2a1a12' }} walking={walking} />
          </group>
        )}
        {/* Invisible hit volume so the customer is easy to target */}
        <mesh position={[look.companion ? 0.25 : 0, look.height / 2, 0]} visible={false}>
          <boxGeometry args={[look.companion ? 1.1 : 0.6, look.height, 0.5]} />
        </mesh>
      </Interactable>
      {stage !== 'entering' && stage !== 'leaving' && (
        <Html position={[0, look.height + 0.28, 0]} center distanceFactor={6} zIndexRange={[10, 0]}>
          <div className="npc-tag">
            <span>{name}</span>
            <i style={{ width: `${Math.max(4, patience)}%`, background: mood }} />
          </div>
        </Html>
      )}
    </group>
  );
});

export function Customers() {
  const deal = useGame((s) => s.deal);
  if (!deal) return null;
  return (
    <NpcActor
      key={deal.customer.id}
      look={deal.customer.appearance}
      stage={deal.stage}
      name={deal.customer.name}
      patience={Math.round(deal.patience)}
    />
  );
}
