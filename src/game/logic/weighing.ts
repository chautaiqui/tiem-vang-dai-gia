import type { Rng } from './rng';
import { randInt } from './rng';
import { roundTo } from './units';

export interface ScaleSpec {
  name: string;
  stabilizeMs: number;
  /** Max residual error (mg) once the reading settles. */
  errorMg: number;
  /** Weight of the tray that sits on the pan — must be tared out. */
  trayMg: number;
}

export const SCALE_BASIC: ScaleSpec = { name: 'Cân điện tử 0,01 g', stabilizeMs: 2400, errorMg: 10, trayMg: 1250 };
export const SCALE_PRO: ScaleSpec = { name: 'Cân phân tích cao cấp', stabilizeMs: 900, errorMg: 0, trayMg: 1250 };

export interface ScaleState {
  tareMg: number;
  item: { actualMg: number; errorMg: number } | null;
  /** Last time something changed on the pan; the display wobbles after that. */
  changedAt: number;
}

export const initialScale = (now: number): ScaleState => ({ tareMg: 0, item: null, changedAt: now });

const settledGross = (s: ScaleState, spec: ScaleSpec) => spec.trayMg + (s.item ? s.item.actualMg + s.item.errorMg : 0);

export function placeItem(s: ScaleState, actualMg: number, spec: ScaleSpec, rng: Rng, now: number): ScaleState {
  const errorMg = roundTo(randInt(rng, -spec.errorMg, spec.errorMg), 10);
  return { ...s, item: { actualMg, errorMg }, changedAt: now };
}

export const removeItem = (s: ScaleState, now: number): ScaleState => ({ ...s, item: null, changedAt: now });

/** TARE zeroes whatever is on the pan right now (tray, and the item if the player was careless). */
export const tare = (s: ScaleState, spec: ScaleSpec, now: number): ScaleState => ({
  ...s, tareMg: settledGross(s, spec), changedAt: now,
});

export interface Reading { mg: number; stable: boolean }

/** Display resolution is 0,01 g → readings snap to 10 mg. */
export function readScale(s: ScaleState, spec: ScaleSpec, now: number, rng: Rng): Reading {
  const net = settledGross(s, spec) - s.tareMg;
  const elapsed = now - s.changedAt;
  if (elapsed >= spec.stabilizeMs) return { mg: roundTo(net, 10), stable: true };
  const amp = 600 * (1 - elapsed / spec.stabilizeMs);
  return { mg: roundTo(net + (rng() * 2 - 1) * amp, 10), stable: false };
}

/** Discrepancy (in the shop's favour) that a picky customer will notice. */
export const PICKY_TOLERANCE_MG = 20;
/** Discrepancy anyone is likely to notice. */
export const OBVIOUS_ERROR_MG = 150;
