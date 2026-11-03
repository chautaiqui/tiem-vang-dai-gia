/** Seeded PRNG (mulberry32) so a game day is reproducible from its seed. */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(...parts: number[]): number {
  let h = 2166136261;
  for (const p of parts) {
    h ^= p >>> 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
  }
  return h >>> 0;
}

export const randInt = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
export const randRange = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
export const chance = (rng: Rng, p: number) => rng() < p;
export const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)];

export function pickWeighted<T extends string>(rng: Rng, weights: Partial<Record<T, number>>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
  let r = rng() * total;
  for (const [k, w] of entries) {
    r -= Math.max(0, w);
    if (r < 0) return k;
  }
  return entries[entries.length - 1][0];
}
