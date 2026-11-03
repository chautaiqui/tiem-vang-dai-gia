import { MeshStandardMaterial } from 'three';
import type { Karat } from '../logic/gold';
import type { Shape } from '../logic/products';

const COLORS: Record<Karat, string> = { K24: '#ffbe3b', K18: '#f0c873', K14: '#e3b487', FAKE: '#f5cf5f' };
const materials = new Map<Karat, MeshStandardMaterial>();

export function goldMaterial(k: Karat): MeshStandardMaterial {
  let m = materials.get(k);
  if (!m) {
    m = new MeshStandardMaterial({ color: COLORS[k], metalness: 1, roughness: k === 'FAKE' ? 0.4 : 0.2 });
    materials.set(k, m);
  }
  return m;
}

/** Low-poly jewellery. Size ≈ real size × `size` (1 = life-size-ish, enlarged for readability). */
export function GoldPiece({ shape, karat, size = 1, ...props }: { shape: Shape; karat: Karat; size?: number } & JSX.IntrinsicElements['group']) {
  const m = goldMaterial(karat);
  const s = 0.02 * size;
  return (
    <group {...props}>
      {shape === 'bar-ring' && (
        <mesh material={m} rotation={[Math.PI / 2.4, 0, 0]}>
          <torusGeometry args={[s, s * 0.32, 8, 20]} />
        </mesh>
      )}
      {shape === 'ring' && (
        <group rotation={[Math.PI / 2.4, 0, 0]}>
          <mesh material={m}><torusGeometry args={[s, s * 0.18, 6, 20]} /></mesh>
          <mesh position={[0, s * 1.1, 0]}>
            <octahedronGeometry args={[s * 0.35]} />
            <meshStandardMaterial color="#e8f6ff" metalness={0.1} roughness={0} />
          </mesh>
        </group>
      )}
      {shape === 'chain' && (
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <mesh material={m}><torusGeometry args={[s * 3, s * 0.08, 4, 36]} /></mesh>
          <mesh material={m} position={[0, -s * 3, 0]}><sphereGeometry args={[s * 0.35, 8, 6]} /></mesh>
        </group>
      )}
      {shape === 'bracelet' && (
        <mesh material={m} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[s * 1.9, s * 0.16, 5, 28]} />
        </mesh>
      )}
      {shape === 'earring' && (
        <group>
          <mesh material={m} position={[-s * 0.6, s * 0.4, 0]}><sphereGeometry args={[s * 0.35, 10, 8]} /></mesh>
          <mesh material={m} position={[s * 0.6, s * 0.4, 0]}><sphereGeometry args={[s * 0.35, 10, 8]} /></mesh>
        </group>
      )}
      {shape === 'pendant' && (
        <mesh material={m} rotation={[Math.PI / 2.5, 0, 0]}>
          <cylinderGeometry args={[s * 0.9, s * 0.9, s * 0.18, 18]} />
        </mesh>
      )}
    </group>
  );
}
