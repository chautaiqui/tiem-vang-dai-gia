import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Euler, Raycaster, Vector2, Vector3 } from 'three';
import { registerPointerLock, useGame } from '../../stores/gameStore';
import { findTarget, interactables } from './registry';

const EYE = 1.62;
const SPEED = 2.4;
const REACH = 2.6;
const DOOR_REACH = 6;
/** Walkable area behind the counter. */
const BOUNDS = { minX: -3.55, maxX: 2.85, minZ: -2.25, maxZ: -1.1 };

const keys = new Set<string>();

export function Player() {
  const { camera, gl } = useThree();
  const euler = useRef(new Euler(0, Math.PI, 0, 'YXZ'));
  const ray = useRef(new Raycaster());
  const frame = useRef(0);
  const tickAcc = useRef(0);

  useEffect(() => {
    camera.position.set(0, EYE, -1.6);
    camera.rotation.copy(euler.current);
    const canvas = gl.domElement;
    const lock = () => {
      const s = useGame.getState();
      if (s.overlay || s.dialog?.choices) return;
      canvas.requestPointerLock?.()?.catch?.(() => {});
    };
    registerPointerLock(lock);
    if (import.meta.env.DEV) (window as unknown as { __look: (yaw: number, pitch: number, x?: number) => void }).__look = (yaw, pitch, x) => {
      euler.current.set(pitch, yaw, 0);
      camera.rotation.copy(euler.current);
      if (x !== undefined) camera.position.x = x;
    };

    const onClick = () => lock();
    const onLockChange = () => useGame.getState().setPointerLocked(document.pointerLockElement === canvas);
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      const eu = euler.current;
      eu.y -= e.movementX * 0.0022;
      eu.x = Math.max(-1.3, Math.min(1.3, eu.x - e.movementY * 0.0022));
      camera.rotation.copy(eu);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      keys.add(e.code);
      const s = useGame.getState();
      if (e.code === 'KeyE' && !e.repeat && !s.overlay) {
        if (s.dialog && !s.dialog.choices) s.closeDialog();
        else if (s.focus && !s.dialog) s.interact(s.focus);
      }
      if (e.code === 'KeyH' && !e.repeat) s.overlay === 'help' ? s.closeOverlay() : !s.overlay && s.openOverlay('help');
      if (e.code === 'Escape') s.overlay ? s.closeOverlay() : s.dialog && !s.dialog.choices && s.closeDialog();
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    const onBlur = () => keys.clear();

    canvas.addEventListener('click', onClick);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [camera, gl]);

  const fwd = useRef(new Vector3());
  const right = useRef(new Vector3());

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    // R3F aims the default camera at the origin after mount; keep our own yaw/pitch authoritative.
    camera.rotation.copy(euler.current);
    const s = useGame.getState();
    // Patience drains at 4 Hz — no need to churn React state every frame.
    tickAcc.current += dt;
    if (tickAcc.current >= 0.25) {
      s.tick(tickAcc.current);
      tickAcc.current = 0;
    }

    if (!s.overlay) {
      const f = fwd.current.set(-Math.sin(euler.current.y), 0, -Math.cos(euler.current.y));
      const r = right.current.set(-f.z, 0, f.x);
      let mx = 0;
      let mz = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) { mx += f.x; mz += f.z; }
      if (keys.has('KeyS') || keys.has('ArrowDown')) { mx -= f.x; mz -= f.z; }
      if (keys.has('KeyD') || keys.has('ArrowRight')) { mx += r.x; mz += r.z; }
      if (keys.has('KeyA') || keys.has('ArrowLeft')) { mx -= r.x; mz -= r.z; }
      const len = Math.hypot(mx, mz);
      if (len > 0) {
        camera.position.x = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, camera.position.x + (mx / len) * SPEED * dt));
        camera.position.z = Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, camera.position.z + (mz / len) * SPEED * dt));
        camera.position.y = EYE + Math.sin(performance.now() / 110) * 0.012;
      }
    }

    // Centre-screen ray for interaction, a few times per second is plenty.
    if (++frame.current % 4 === 0) {
      ray.current.setFromCamera(new Vector2(0, 0), camera);
      ray.current.far = DOOR_REACH;
      const hit = ray.current.intersectObjects([...interactables], true)[0];
      const target = hit ? findTarget(hit.object) : null;
      // The door is across the shop floor from the counter, so it gets a longer reach.
      s.setFocus(target && (hit.distance <= REACH || target === 'door') ? target : null);
    }
  });

  return null;
}
