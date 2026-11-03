import { describe, expect, it } from 'vitest';
import { buildTable, buyValue, refineValue, START_SPOT, makeDayPrices } from '../pricing';
import { valueAtChiPrice, roundTo, MG_PER_CHI } from '../units';
import { evaluateOffer, counterPrice, overchargeRatio, type Terms } from '../negotiation';
import { initialScale, placeItem, readScale, removeItem, tare, SCALE_BASIC, SCALE_PRO } from '../weighing';
import { acidTest } from '../inspection';
import { mulberry32 } from '../rng';
import {
  applyBuyback, applyExchange, applySale, buyUpgrade, closeDay, listPrice, netWorth, newGame, refineScrap, restock,
  startNextDay, totalMoney, STARTING_CAPITAL, openShop, customerDone, moveFunds,
} from '../game';

describe('units', () => {
  it('values weight at a per-chỉ price with integer rounding', () => {
    expect(valueAtChiPrice(MG_PER_CHI, 12_000_000)).toBe(12_000_000);
    expect(valueAtChiPrice(7_500, 3_200_000 * 3.75 * 0.75)).toBe(18_000_000); // plan example: 7,5 g 18K
    expect(Number.isInteger(valueAtChiPrice(1_237, 11_990_000))).toBe(true);
    expect(roundTo(1_499, 1_000)).toBe(1_000);
    expect(roundTo(1_500, 1_000)).toBe(2_000);
  });
});

describe('pricing', () => {
  it('builds a board with sell > buy and lower karats cheaper', () => {
    const t = buildTable(START_SPOT);
    for (const k of ['K24', 'K18', 'K14'] as const) expect(t[k].sell).toBeGreaterThan(t[k].buy);
    expect(t.K18.sell).toBeLessThan(t.K24.sell);
    expect(t.K14.sell).toBeLessThan(t.K18.sell);
    expect(t.K24.sell % 10_000).toBe(0);
  });
  it('fake gold has zero value and refining uses true purity', () => {
    const p = makeDayPrices(1, START_SPOT, null);
    expect(buyValue(p, 'FAKE', 5_000)).toBe(0);
    expect(refineValue(p, 'FAKE', 5_000)).toBe(0);
    expect(refineValue(p, 'K18', 7_500)).toBeGreaterThan(buyValue(p, 'K18', 7_500));
  });
});

describe('negotiation', () => {
  const buy: Terms = { intent: 'purchase', fair: 10_000_000, base: 10_000_000, accept: -0.01, max: 0.01 };
  const sell: Terms = { intent: 'sellback', fair: 10_000_000, base: 10_000_000, accept: 0, max: 0.03 };
  const rng = mulberry32(1);
  it('accepts good offers and rejects outrageous ones', () => {
    expect(evaluateOffer(buy, 9_800_000, 0, rng).type).toBe('accept');
    expect(evaluateOffer(buy, 12_000_000, 0, rng)).toMatchObject({ type: 'reject', insulted: true });
    expect(evaluateOffer(sell, 10_100_000, 0, rng).type).toBe('accept');
    expect(evaluateOffer(sell, 8_000_000, 0, rng)).toMatchObject({ type: 'reject', insulted: true });
  });
  it('counter offers lie between accept and max and favour the customer', () => {
    const c = counterPrice(buy, 0);
    expect(overchargeRatio(buy, c)).toBeGreaterThanOrEqual(buy.accept - 0.002);
    expect(overchargeRatio(buy, c)).toBeLessThanOrEqual(buy.max);
    const cs = counterPrice(sell, 0);
    expect(cs).toBeLessThanOrEqual(10_000_000);
    expect(cs % 10_000).toBe(0);
  });
  it('respects budget', () => {
    const v = evaluateOffer({ ...buy, budget: 9_000_000 }, 9_500_000, 0, rng);
    expect(v).toMatchObject({ type: 'reject', overBudget: true });
    if (v.type === 'reject') expect(v.price).toBeLessThanOrEqual(9_000_000);
  });
});

describe('weighing', () => {
  const rng = mulberry32(2);
  it('shows tray weight until tared, then the item weight once settled', () => {
    let sc = initialScale(0);
    expect(readScale(sc, SCALE_PRO, 5_000, rng)).toEqual({ mg: SCALE_PRO.trayMg, stable: true });
    sc = placeItem(sc, 7_500, SCALE_PRO, rng, 5_000);
    expect(readScale(sc, SCALE_PRO, 5_100, rng).stable).toBe(false);
    expect(readScale(sc, SCALE_PRO, 10_000, rng).mg).toBe(7_500 + SCALE_PRO.trayMg);
    sc = tare(removeItem(sc, 10_000), SCALE_PRO, 10_000);
    sc = placeItem(sc, 7_500, SCALE_PRO, rng, 11_000);
    expect(readScale(sc, SCALE_PRO, 20_000, rng)).toEqual({ mg: 7_500, stable: true });
  });
  it('taring with the item on the pan zeroes it out', () => {
    let sc = placeItem(initialScale(0), 3_750, SCALE_PRO, rng, 0);
    sc = tare(sc, SCALE_PRO, 1_000);
    expect(readScale(sc, SCALE_PRO, 5_000, rng).mg).toBe(0);
  });
  it('basic scale error is bounded', () => {
    for (let i = 0; i < 50; i++) {
      const sc = placeItem(tare(initialScale(0), SCALE_BASIC, 0), 3_750, SCALE_BASIC, rng, 0);
      expect(Math.abs(readScale(sc, SCALE_BASIC, 5_000, rng).mg - 3_750)).toBeLessThanOrEqual(SCALE_BASIC.errorMg);
    }
  });
});

describe('inspection', () => {
  const rng = mulberry32(3);
  it('acid ladder distinguishes karats', () => {
    expect(acidTest('K24', 'A22', rng, 0)).toBe('intact');
    expect(acidTest('K18', 'A18', rng, 0)).toBe('intact');
    expect(acidTest('K18', 'A22', rng, 0)).toBe('fading');
    expect(acidTest('K14', 'A18', rng, 0)).toBe('fading');
    expect(acidTest('K14', 'A22', rng, 0)).toBe('dissolved');
    expect(acidTest('FAKE', 'A14', rng, 0)).toBe('dissolved');
  });
});

describe('ledger', () => {
  it('new game spends exactly the starting capital on money + stock', () => {
    const s = newGame(42);
    const stockCost = s.products.reduce((a, p) => a + p.cost, 0);
    expect(totalMoney(s) + stockCost).toBe(STARTING_CAPITAL);
    expect(s.products.length).toBeGreaterThanOrEqual(10);
    expect(s.customers.length).toBeGreaterThanOrEqual(3);
  });

  it('sale moves money and stock consistently', () => {
    const s = newGame(1);
    const p = s.products[0];
    const price = listPrice(s.prices, p);
    const after = applySale(s, { customer: s.customers[0], productId: p.id, price, method: 'cash', recordedWeightMg: p.weightMg });
    expect(after.shop.cash).toBe(s.shop.cash + price);
    expect(after.products.length).toBe(s.products.length - 1);
    expect(after.today.revenue).toBe(price);
    expect(after.today.cogs).toBe(p.cost);
    expect(after.transactions.at(-1)!.kind).toBe('sale');
  });

  it('buyback then refine realises true value', () => {
    const s = newGame(1);
    const old = { name: 'Lắc tay cũ', shape: 'bracelet' as const, trueKarat: 'K14' as const, claimedKarat: 'K18' as const, weightMg: 7_500 };
    const price = 15_000_000;
    const a = applyBuyback(s, { customer: s.customers[0], oldGold: old, assessedKarat: 'K18', recordedWeightMg: 7_500, price, method: 'transfer' });
    expect(a.shop.bank).toBe(s.shop.bank - price);
    expect(a.scrap).toHaveLength(1);
    const r = refineScrap(a, [a.scrap[0].id]);
    expect(r.state.scrap).toHaveLength(0);
    expect(r.proceeds).toBe(refineValue(s.prices, 'K14', 7_500));
    expect(r.proceeds).toBeLessThan(price); // mis-assessed 14K as 18K → loss
  });

  it('exchange settles the net difference', () => {
    const s = newGame(5);
    const p = s.products.find((x) => x.templateId === 'nhan-2chi')!;
    const old = { name: 'Nhẫn trơn cũ', shape: 'bar-ring' as const, trueKarat: 'K24' as const, claimedKarat: 'K24' as const, weightMg: 3_750 };
    const newPrice = listPrice(s.prices, p);
    const oldPrice = buyValue(s.prices, 'K24', 3_750);
    const a = applyExchange(s, {
      customer: s.customers[0], productId: p.id, newPrice, newRecordedWeightMg: p.weightMg, oldGold: old,
      assessedKarat: 'K24', oldRecordedWeightMg: 3_750, oldPrice, method: 'cash',
    });
    expect(a.shop.cash).toBe(s.shop.cash + newPrice - oldPrice);
    expect(a.scrap).toHaveLength(1);
    expect(a.products).toHaveLength(s.products.length - 1);
  });

  it('refuses purchases the shop cannot afford', () => {
    const s = newGame(1);
    const broke = { ...s, shop: { ...s.shop, cash: 0, bank: 0 } };
    expect(restock(broke, 'nhan-1chi', 1)).toBeNull();
    expect(buyUpgrade(broke, 'scalePro')).toBeNull();
    expect(() =>
      applyBuyback(broke, { customer: s.customers[0], oldGold: { name: 'x', shape: 'ring', trueKarat: 'K18', claimedKarat: 'K18', weightMg: 1000 }, assessedKarat: 'K18', recordedWeightMg: 1000, price: 1, method: 'cash' }),
    ).toThrow();
  });
});

describe('simulation', () => {
  it('plays 15 days with an honest strategy without corrupting state', () => {
    let s = newGame(2024);
    for (let d = 0; d < 15; d++) {
      s = openShop(s);
      while (s.customerIndex < s.customers.length) {
        const c = s.customers[s.customerIndex];
        if (c.intent === 'purchase') {
          const p = s.products.find((x) => x.templateId === c.wantTemplateId);
          if (p) s = applySale(s, { customer: c, productId: p.id, price: listPrice(s.prices, p), method: c.payMethod, recordedWeightMg: p.weightMg });
          s = customerDone(s, !!p);
        } else if (c.intent === 'sellback' && c.oldGold!.trueKarat !== 'FAKE') {
          const price = buyValue(s.prices, c.oldGold!.trueKarat, c.oldGold!.weightMg);
          const method = s.shop.bank >= price ? 'transfer' : 'cash';
          s = applyBuyback(s, { customer: c, oldGold: c.oldGold!, assessedKarat: c.oldGold!.trueKarat, recordedWeightMg: c.oldGold!.weightMg, price, method });
          s = customerDone(s, true);
        } else {
          s = customerDone(s, false);
        }
      }
      s = moveFunds(s, Math.max(0, s.shop.cash - 80_000_000)) ?? s;
      if (s.scrap.length) s = refineScrap(s, s.scrap.map((x) => x.id)).state;
      for (const tid of ['nhan-1chi', 'nhan-2chi']) {
        if (s.products.filter((p) => p.templateId === tid).length < 2) s = restock(s, tid, 2) ?? s;
      }
      const closed = closeDay(s);
      s = closed.state;
      expect(s.phase).toBe('report');
      for (const p of s.products) expect(Number.isInteger(p.cost)).toBe(true);
      expect(Number.isInteger(s.shop.cash) && Number.isInteger(s.shop.bank)).toBe(true);
      expect(new Set(s.products.map((p) => p.id)).size).toBe(s.products.length);
      s = startNextDay(s);
    }
    expect(s.day).toBe(16);
    expect(netWorth(s)).toBeGreaterThan(400_000_000);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s); // save-serialisable
  });
});

describe('balance', () => {
  it('an honest 9999 sale covers more than its restock cost', () => {
    const s = newGame(9);
    const p = s.products.find((x) => x.templateId === 'nhan-2chi')!;
    expect(listPrice(s.prices, p) - p.cost).toBeGreaterThan(300_000);
  });
});
