import { Vector3, type Object3D } from 'three';
import type { Target } from '../../stores/gameStore';

/** Objects the player's centre ray can hit. Each carries userData.target. */
export const interactables = new Set<Object3D>();

export function findTarget(o: Object3D | null): Target | null {
  while (o) {
    if (o.userData.target) return o.userData.target as Target;
    o = o.parent;
  }
  return null;
}

/** Live NPC position, shared with the door animation. */
export const npcPosition = new Vector3(0, 0, 6);
