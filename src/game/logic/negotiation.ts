import type { Intent } from './customers';
import type { Rng } from './rng';
import { roundTo } from './units';

/**
 * Every deal reduces to one number the customer cares about: how much the shop
 * over-charges them relative to what they consider fair.
 *   purchase : quote − fair         (paying more than fair)
 *   sellback : fair − quote         (receiving less than fair)
 *   exchange : netQuote − fairNet   (net payment above fair net)
 * The ratio overcharge / base is compared to the customer's margins.
 */
export interface Terms {
  intent: Intent;
  /** Fair price (purchase / sellback) or fair net payment (exchange), from the customer's view. */
  fair: number;
  /** Denominator for ratios — the value of the larger item. */
  base: number;
  accept: number;
  max: number;
  /** Purchase/exchange: hard cap on what the customer can pay. */
  budget?: number;
}

export type Verdict =
  | { type: 'accept' }
  | { type: 'counter'; price: number }
  | { type: 'reject'; price: number; insulted: boolean; overBudget?: boolean };

const STEP = 10_000;

export function overchargeRatio(t: Terms, quote: number): number {
  const oc = t.intent === 'sellback' ? t.fair - quote : quote - t.fair;
  return oc / Math.max(1, t.base);
}

/** Margins shift with trust: a trusting customer tolerates ±2,5% more. */
export function marginsWithTrust(accept: number, max: number, trust: number) {
  const shift = ((trust - 50) / 50) * 0.01;
  return { accept: accept + shift, max: max + shift * 2.5 };
}

/** Price the customer proposes at a given round; concedes toward `max` over time. */
export function counterPrice(t: Terms, round: number): number {
  const concession = Math.min(1, 0.25 + round * 0.25);
  const ratio = t.accept + (t.max - t.accept) * concession * 0.8;
  const oc = ratio * t.base;
  let price = t.intent === 'sellback' ? t.fair - oc : t.fair + oc;
  // Customers round in their own favour.
  price = t.intent === 'sellback' ? Math.ceil(price / STEP) * STEP : Math.floor(price / STEP) * STEP;
  if (t.budget !== undefined && t.intent !== 'sellback') price = Math.min(price, t.budget);
  return price;
}

export function evaluateOffer(t: Terms, quote: number, round: number, rng: Rng): Verdict {
  if (t.budget !== undefined && t.intent !== 'sellback' && quote > t.budget) {
    return { type: 'reject', price: Math.min(counterPrice(t, round), t.budget), insulted: false, overBudget: true };
  }
  const r = overchargeRatio(t, quote);
  if (r <= t.accept) return { type: 'accept' };
  if (r <= t.max) {
    const closeness = 1 - (r - t.accept) / Math.max(1e-9, t.max - t.accept);
    const p = Math.min(0.95, 0.35 * closeness + round * 0.15);
    if (rng() < p) return { type: 'accept' };
    const price = counterPrice(t, round);
    // A counter only makes sense if it is better for the customer than the shop's offer.
    const better = t.intent === 'sellback' ? price > quote : price < quote;
    return better ? { type: 'counter', price } : { type: 'accept' };
  }
  return { type: 'reject', price: counterPrice(t, round), insulted: r > t.max + 0.06 };
}

/** Rounded helper used by the UI to snap quotes. */
export const snapQuote = (n: number) => roundTo(n, STEP);
