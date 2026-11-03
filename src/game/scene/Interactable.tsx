import { useEffect, useRef, type ReactNode } from 'react';
import type { Group } from 'three';
import type { Target } from '../../stores/gameStore';
import { interactables } from './registry';

export function Interactable({ target, children, ...props }: { target: Target; children: ReactNode } & JSX.IntrinsicElements['group']) {
  const ref = useRef<Group>(null);
  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    g.userData.target = target;
    interactables.add(g);
    return () => void interactables.delete(g);
  }, [target]);
  return (
    <group ref={ref} {...props}>
      {children}
    </group>
  );
}
