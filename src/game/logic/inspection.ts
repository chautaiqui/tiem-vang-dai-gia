import { KARATS, type Karat } from './gold';
import { chance, type Rng } from './rng';

export type Acid = 'A14' | 'A18' | 'A22';
export type AcidResult = 'intact' | 'fading' | 'dissolved' | 'unclear';

export const ACIDS: Record<Acid, { label: string; threshold: number; color: string }> = {
  A14: { label: 'Nước thử 14K', threshold: 5850, color: '#7fb3d5' },
  A18: { label: 'Nước thử 18K', threshold: 7500, color: '#82c29a' },
  A22: { label: 'Nước thử 22K', threshold: 9160, color: '#d98880' },
};

export const ACID_RESULT_TEXT: Record<AcidResult, string> = {
  intact: 'Vệt vàng giữ nguyên',
  fading: 'Vệt vàng mờ dần',
  dissolved: 'Vệt vàng tan biến',
  unclear: 'Phản ứng không rõ — nên thử lại',
};

/**
 * The streak survives an acid rated at or below its purity; just below the
 * threshold it fades, far below it dissolves. Basic kits are sometimes unclear.
 */
export function acidTest(trueKarat: Karat, acid: Acid, rng: Rng, unclearChance = 0.12): AcidResult {
  if (chance(rng, unclearChance)) return 'unclear';
  const purity = KARATS[trueKarat].purity;
  const threshold = ACIDS[acid].threshold;
  if (purity >= threshold) return 'intact';
  return purity >= threshold - 1800 ? 'fading' : 'dissolved';
}

/** XRF analyser reading, gold % with ±0,3% noise. Fake (plated) shows a trace amount. */
export function xrfReading(trueKarat: Karat, rng: Rng): number {
  const base = trueKarat === 'FAKE' ? 1.2 + rng() * 2 : KARATS[trueKarat].purity / 100;
  const v = base + (rng() * 2 - 1) * 0.3;
  return Math.min(99.99, Math.round(v * 100) / 100);
}

export const ACID_GUIDE = [
  '9999: giữ nguyên với cả 3 loại nước thử.',
  '18K: giữ nguyên với 14K, 18K — mờ dần với 22K.',
  '14K: giữ nguyên với 14K — mờ với 18K — tan với 22K.',
  'Không đạt: tan ngay với nước thử 14K.',
];
