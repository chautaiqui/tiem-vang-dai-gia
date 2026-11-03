import type { Karat, TradedKarat } from './gold';
import { type Rng, randInt, pick } from './rng';
import { roundTo } from './units';

export type Shape = 'ring' | 'chain' | 'bracelet' | 'earring' | 'pendant' | 'bar-ring';

export interface ProductTemplate {
  id: string;
  name: string;
  karat: TradedKarat;
  baseWeightMg: number;
  /** ± fraction of weight variation between pieces (0 = exact, e.g. 9999 rings). */
  weightJitter: number;
  /** Tiền công charged to the customer. */
  laborFee: number;
  /** Tiền công paid to the workshop when restocking. */
  laborCost: number;
  minLevel: number;
  shape: Shape;
}

export const PRODUCT_TEMPLATES: ProductTemplate[] = [
  { id: 'nhan-1chi', name: 'Nhẫn tròn trơn 9999 – 1 chỉ', karat: 'K24', baseWeightMg: 3750, weightJitter: 0, laborFee: 100_000, laborCost: 40_000, minLevel: 1, shape: 'bar-ring' },
  { id: 'nhan-2chi', name: 'Nhẫn tròn trơn 9999 – 2 chỉ', karat: 'K24', baseWeightMg: 7500, weightJitter: 0, laborFee: 150_000, laborCost: 60_000, minLevel: 1, shape: 'bar-ring' },
  { id: 'nhan-5chi', name: 'Nhẫn tròn trơn 9999 – 5 chỉ', karat: 'K24', baseWeightMg: 18750, weightJitter: 0, laborFee: 250_000, laborCost: 100_000, minLevel: 1, shape: 'bar-ring' },
  { id: 'nhan-1luong', name: 'Nhẫn ép vỉ 9999 – 1 lượng', karat: 'K24', baseWeightMg: 37500, weightJitter: 0, laborFee: 350_000, laborCost: 150_000, minLevel: 1, shape: 'bar-ring' },
  { id: 'mat-than-tai', name: 'Mặt dây Thần Tài 9999 – 1 chỉ', karat: 'K24', baseWeightMg: 3750, weightJitter: 0, laborFee: 350_000, laborCost: 150_000, minLevel: 1, shape: 'pendant' },
  { id: 'nhan-cuoi-18k', name: 'Nhẫn cưới 18K', karat: 'K18', baseWeightMg: 2800, weightJitter: 0.12, laborFee: 900_000, laborCost: 400_000, minLevel: 1, shape: 'ring' },
  { id: 'day-chuyen-18k', name: 'Dây chuyền 18K', karat: 'K18', baseWeightMg: 7500, weightJitter: 0.15, laborFee: 1_200_000, laborCost: 550_000, minLevel: 2, shape: 'chain' },
  { id: 'lac-tay-18k', name: 'Lắc tay 18K', karat: 'K18', baseWeightMg: 9000, weightJitter: 0.15, laborFee: 1_100_000, laborCost: 500_000, minLevel: 2, shape: 'bracelet' },
  { id: 'bong-tai-14k', name: 'Bông tai 14K', karat: 'K14', baseWeightMg: 2000, weightJitter: 0.15, laborFee: 450_000, laborCost: 200_000, minLevel: 2, shape: 'earring' },
  { id: 'nhan-da-14k', name: 'Nhẫn đính đá 14K', karat: 'K14', baseWeightMg: 2600, weightJitter: 0.15, laborFee: 650_000, laborCost: 300_000, minLevel: 2, shape: 'ring' },
];

export const TEMPLATE_BY_ID: Record<string, ProductTemplate> = Object.fromEntries(
  PRODUCT_TEMPLATES.map((t) => [t.id, t]),
);

export interface Product {
  id: string;
  templateId: string;
  name: string;
  karat: TradedKarat;
  weightMg: number;
  laborFee: number;
  /** Acquisition cost (giá vốn), VND. */
  cost: number;
  acquiredDay: number;
}

/** Old gold the shop bought back. True purity is only revealed at the refinery. */
export interface ScrapItem {
  id: string;
  name: string;
  trueKarat: Karat;
  weightMg: number;
  assessedKarat: Karat;
  recordedWeightMg: number;
  cost: number;
  acquiredDay: number;
}

export function rollWeight(rng: Rng, t: ProductTemplate): number {
  if (t.weightJitter === 0) return t.baseWeightMg;
  const span = Math.round(t.baseWeightMg * t.weightJitter);
  return roundTo(t.baseWeightMg + randInt(rng, -span, span), 10);
}

/** What a customer might bring in to sell. */
export interface OldGold {
  name: string;
  shape: Shape;
  trueKarat: Karat;
  claimedKarat: Karat;
  weightMg: number;
}

const OLD_GOLD_KINDS: { name: string; shape: Shape; karats: TradedKarat[]; minMg: number; maxMg: number }[] = [
  { name: 'Nhẫn trơn cũ', shape: 'bar-ring', karats: ['K24'], minMg: 3_740, maxMg: 7_500 },
  { name: 'Nhẫn cũ', shape: 'ring', karats: ['K18', 'K14'], minMg: 1_800, maxMg: 4_500 },
  { name: 'Lắc tay cũ', shape: 'bracelet', karats: ['K18', 'K14'], minMg: 5_000, maxMg: 11_000 },
  { name: 'Dây chuyền cũ', shape: 'chain', karats: ['K18', 'K24'], minMg: 4_000, maxMg: 12_000 },
  { name: 'Bông tai cũ', shape: 'earring', karats: ['K18', 'K14'], minMg: 1_200, maxMg: 3_000 },
  { name: 'Kiềng vàng cũ', shape: 'bracelet', karats: ['K24'], minMg: 11_250, maxMg: 22_500 },
];

export function rollOldGold(rng: Rng, scam: boolean): OldGold {
  const kind = pick(rng, OLD_GOLD_KINDS);
  const karat = pick(rng, kind.karats);
  const weightMg = roundTo(randInt(rng, kind.minMg, kind.maxMg), 10);
  if (scam) {
    const claimed: TradedKarat = kind.karats.includes('K24') ? 'K24' : 'K18';
    // A scammer either brings plated junk or claims a higher karat than the real one.
    const trueKarat: Karat = rng() < 0.6 ? 'FAKE' : claimed === 'K24' ? 'K18' : 'K14';
    return { name: kind.name, shape: kind.shape, trueKarat, claimedKarat: claimed, weightMg };
  }
  return { name: kind.name, shape: kind.shape, trueKarat: karat, claimedKarat: karat, weightMg };
}
