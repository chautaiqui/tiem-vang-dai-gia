import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3, type Group } from 'three';
import { useGame } from '../../stores/gameStore';
import { TEMPLATE_BY_ID } from '../logic/products';
import { GoldPiece } from './GoldPiece';

const OFFSET = new Vector3(0.26, -0.2, -0.45);

/** Gold the player is currently handling, drawn in front of the camera. */
export function HeldItem() {
  const { camera } = useThree();
  const ref = useRef<Group>(null);
  const product = useGame((s) => (s.deal?.productId && s.game ? s.game.products.find((p) => p.id === s.deal!.productId) : undefined));
  const old = useGame((s) => (s.deal?.hasOld && s.deal.stage === 'serving' ? s.deal.customer.oldGold : undefined));

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    g.position.copy(camera.localToWorld(OFFSET.clone()));
    g.quaternion.copy(camera.quaternion);
    g.rotateY(performance.now() / 1500);
  });

  if (!product && !old) return null;
  return (
    <group ref={ref}>
      {product && <GoldPiece shape={TEMPLATE_BY_ID[product.templateId].shape} karat={product.karat} size={1.4} position={[old ? -0.04 : 0, 0, 0]} />}
      {old && <GoldPiece shape={old.shape} karat={old.trueKarat} size={1.4} position={[product ? 0.05 : 0, -0.02, 0]} />}
    </group>
  );
}
