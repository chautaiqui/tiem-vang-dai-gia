/**
 * Business units. Money is always an integer number of VND, weight an integer
 * number of milligrams. Every computation that can produce a fraction ends in
 * an explicit rounding call (half-up to the nearest step) — never raw floats.
 */
export const MG_PER_PHAN = 375;
export const MG_PER_CHI = 3750;
export const MG_PER_LUONG = 37500;

/** Prices are quoted to the nearest 1.000 đ; board prices to the nearest 10.000 đ. */
export const MONEY_STEP = 1_000;
export const BOARD_STEP = 10_000;

export function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

/** Value of `weightMg` of metal at a per-chỉ price, rounded to 1.000 đ. */
export function valueAtChiPrice(weightMg: number, pricePerChi: number): number {
  return roundTo((weightMg * pricePerChi) / MG_PER_CHI, MONEY_STEP);
}

const vnd = new Intl.NumberFormat('vi-VN');

export function formatVnd(n: number): string {
  return `${vnd.format(Math.round(n))} đ`;
}

/** Compact form for HUD: 512,3 tr */
export function formatMillions(n: number): string {
  const m = n / 1_000_000;
  return `${m.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
}

export function formatGram(mg: number): string {
  return `${(mg / 1000).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} g`;
}

export function formatChi(mg: number): string {
  return `${(mg / MG_PER_CHI).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} chỉ`;
}

export function formatPercent(ratio: number, digits = 1): string {
  return `${(ratio * 100).toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}
