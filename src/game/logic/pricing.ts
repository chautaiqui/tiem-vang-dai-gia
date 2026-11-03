import { KARATS, type Karat, type TradedKarat, TRADED_KARATS } from './gold';
import { chance, pick, type Rng } from './rng';
import { BOARD_STEP, roundTo, valueAtChiPrice } from './units';

/** Simulated reference ("spot") price for 9999 gold, VND per chỉ. Not real market data. */
export const START_SPOT = 12_000_000;
export const SPOT_MIN = 8_000_000;
export const SPOT_MAX = 18_000_000;
const DAILY_SWING = 0.012;

/** Spread around the karat's mid price: shop sells at +sell, buys back at -buy. */
export const SPREADS: Record<TradedKarat, { sell: number; buy: number }> = {
  K24: { sell: 0.015, buy: 0.01 },
  K18: { sell: 0.03, buy: 0.07 },
  K14: { sell: 0.03, buy: 0.08 },
};

/** Refinery processing fee on the melt value of scrap. */
export const REFINE_FEE: Record<TradedKarat, number> = { K24: 0.005, K18: 0.02, K14: 0.02 };
/** Wholesaler premium over mid price when restocking. */
export const WHOLESALE_PREMIUM = 0.002;

export interface MarketEvent {
  id: string;
  title: string;
  description: string;
  /** Extra price drift applied on the day the event appears. */
  drift: number;
  /** Shifts customer intent: positive → more buyers, negative → more sellers. */
  buyBias: number;
  customerBonus: number;
  restockPremium: number;
}

export const MARKET_EVENTS: MarketEvent[] = [
  { id: 'nhu-cau-tang', title: 'Nhu cầu mua vàng tăng mạnh', description: 'Người dân đổ xô đi mua vàng tích trữ. Khách mua đông hơn.', drift: 0.01, buyBias: 0.25, customerBonus: 2, restockPremium: 0 },
  { id: 'gian-doan-cung', title: 'Nguồn cung vàng gián đoạn', description: 'Nhà cung cấp chậm giao hàng, giá nhập tăng.', drift: 0.02, buyBias: 0.1, customerBonus: 0, restockPremium: 0.01 },
  { id: 'thi-truong-giam', title: 'Thị trường vàng giảm mạnh', description: 'Giá lao dốc, nhiều người mang vàng đi bán.', drift: -0.03, buyBias: -0.3, customerBonus: 1, restockPremium: 0 },
  { id: 'lai-suat-tang', title: 'Ngân hàng tăng lãi suất', description: 'Tiền chảy vào tiết kiệm, vàng hạ nhiệt.', drift: -0.012, buyBias: -0.1, customerBonus: 0, restockPremium: 0 },
  { id: 'mua-cuoi', title: 'Mùa cưới', description: 'Nhiều cặp đôi tìm nhẫn cưới, trang sức.', drift: 0.004, buyBias: 0.2, customerBonus: 1, restockPremium: 0 },
];

export interface BoardRow { buy: number; sell: number }

export interface DayPrices {
  day: number;
  spot: number;
  table: Record<TradedKarat, BoardRow>;
  event: MarketEvent | null;
}

export function midPrice(spot: number, karat: Karat): number {
  return (spot * KARATS[karat].purity) / 9999;
}

export function buildTable(spot: number): Record<TradedKarat, BoardRow> {
  const table = {} as Record<TradedKarat, BoardRow>;
  for (const k of TRADED_KARATS) {
    const mid = midPrice(spot, k);
    table[k] = {
      sell: roundTo(mid * (1 + SPREADS[k].sell), BOARD_STEP),
      buy: roundTo(mid * (1 - SPREADS[k].buy), BOARD_STEP),
    };
  }
  return table;
}

export function rollEvent(rng: Rng): MarketEvent | null {
  return chance(rng, 0.25) ? pick(rng, MARKET_EVENTS) : null;
}

export function nextSpot(prev: number, rng: Rng, event: MarketEvent | null): number {
  const change = (rng() * 2 - 1) * DAILY_SWING + (event?.drift ?? 0);
  const next = roundTo(prev * (1 + change), BOARD_STEP);
  return Math.min(SPOT_MAX, Math.max(SPOT_MIN, next));
}

export function makeDayPrices(day: number, spot: number, event: MarketEvent | null): DayPrices {
  return { day, spot, table: buildTable(spot), event };
}

/** What the shop charges for `weightMg` of a traded karat (metal only, no labour). */
export function sellValue(prices: DayPrices, karat: TradedKarat, weightMg: number): number {
  return valueAtChiPrice(weightMg, prices.table[karat].sell);
}

/** Board buy-back value for `weightMg`. Fake gold is worth nothing. */
export function buyValue(prices: DayPrices, karat: Karat, weightMg: number): number {
  if (karat === 'FAKE') return 0;
  return valueAtChiPrice(weightMg, prices.table[karat].buy);
}

/** Cash the refinery pays for scrap — always based on the TRUE purity. */
export function refineValue(prices: DayPrices, trueKarat: Karat, weightMg: number): number {
  if (trueKarat === 'FAKE') return 0;
  const perChi = midPrice(prices.spot, trueKarat) * (1 - REFINE_FEE[trueKarat]);
  return valueAtChiPrice(weightMg, perChi);
}

export function wholesaleMetalCost(prices: DayPrices, karat: TradedKarat, weightMg: number): number {
  const premium = WHOLESALE_PREMIUM + (prices.event?.restockPremium ?? 0);
  return valueAtChiPrice(weightMg, midPrice(prices.spot, karat) * (1 + premium));
}
