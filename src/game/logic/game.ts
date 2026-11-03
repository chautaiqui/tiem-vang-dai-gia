import { customersForDay, generateCustomer, type Customer, type PayMethod } from './customers';
import type { Karat, TradedKarat } from './gold';
import {
  buyValue, makeDayPrices, nextSpot, refineValue, rollEvent, sellValue, wholesaleMetalCost, START_SPOT, type DayPrices,
} from './pricing';
import { PRODUCT_TEMPLATES, TEMPLATE_BY_ID, rollWeight, type OldGold, type Product, type ScrapItem } from './products';
import { hashSeed, mulberry32, type Rng } from './rng';

export const SAVE_VERSION = 1;
export const STARTING_CAPITAL = 500_000_000;

export type UpgradeId = 'scalePro' | 'ledSign' | 'showcase' | 'xrf';

export interface UpgradeInfo { id: UpgradeId; name: string; description: string; price: number; minLevel: number }

export const UPGRADES: UpgradeInfo[] = [
  { id: 'scalePro', name: 'Cân phân tích cao cấp', description: 'Ổn định nhanh, không sai số.', price: 25_000_000, minLevel: 1 },
  { id: 'ledSign', name: 'Biển hiệu LED & quảng cáo', description: '+1 khách mỗi ngày.', price: 30_000_000, minLevel: 1 },
  { id: 'showcase', name: 'Tủ kính & ghế chờ cao cấp', description: 'Khách kiên nhẫn hơn 25%.', price: 40_000_000, minLevel: 2 },
  { id: 'xrf', name: 'Máy quang phổ XRF', description: 'Đọc chính xác hàm lượng vàng, không cần đoán.', price: 120_000_000, minLevel: 2 },
];

export const DAILY_EXPENSE: Record<number, number> = { 1: 1_500_000, 2: 2_500_000 };
export const LEVEL_NAMES: Record<number, string> = { 1: 'Tiệm vàng gia đình', 2: 'Tiệm vàng phố lớn' };
export const LEVEL2_REQUIREMENT = { reputation: 60, netWorth: 530_000_000 };

export type TxKind = 'sale' | 'buyback' | 'exchange' | 'restock' | 'refine' | 'expense' | 'upgrade';
export type MoneyAccount = 'cash' | 'bank';

export interface InvoiceLine {
  label: string;
  karat: Karat;
  weightMg: number;
  pricePerChi: number;
  laborFee: number;
  amount: number;
  /** -1 when the shop buys the item. */
  direction: 1 | -1;
}

export interface Transaction {
  id: string;
  day: number;
  kind: TxKind;
  description: string;
  customerName?: string;
  /** Signed change to the shop's money. */
  amount: number;
  account: MoneyAccount;
  method?: PayMethod;
  revenue: number;
  cogs: number;
  lines?: InvoiceLine[];
}

export interface DayStats {
  day: number;
  revenue: number;
  cogs: number;
  buybackSpend: number;
  refineProceeds: number;
  refineCost: number;
  expenses: number;
  customersServed: number;
  customersLost: number;
  reputationStart: number;
  netWorthStart: number;
}

export interface DayReport extends DayStats {
  grossProfit: number;
  netWorthEnd: number;
  reputationEnd: number;
  cash: number;
  bank: number;
  inventoryValue: number;
  leveledUp: boolean;
}

export type Phase = 'morning' | 'open' | 'report' | 'bankrupt';

export interface Shop { cash: number; bank: number; reputation: number; level: number }

export interface GameState {
  version: number;
  seed: number;
  day: number;
  phase: Phase;
  shop: Shop;
  upgrades: Record<UpgradeId, boolean>;
  products: Product[];
  scrap: ScrapItem[];
  prices: DayPrices;
  priceHistory: { day: number; spot: number }[];
  transactions: Transaction[];
  today: DayStats;
  reports: DayReport[];
  customers: Customer[];
  customerIndex: number;
  nextId: number;
}

/* ───────────── helpers ───────────── */

export function dayRng(state: Pick<GameState, 'seed' | 'day'>, salt: number): Rng {
  return mulberry32(hashSeed(state.seed, state.day, salt));
}

function nextId(state: GameState, prefix: string): [string, GameState] {
  return [`${prefix}${state.nextId}`, { ...state, nextId: state.nextId + 1 }];
}

export const totalMoney = (s: GameState) => s.shop.cash + s.shop.bank;

/** Inventory at the shop's own buy-back price (conservative), scrap at assessed buy-back. */
export function inventoryValue(s: GameState): number {
  const products = s.products.reduce((sum, p) => sum + buyValue(s.prices, p.karat, p.weightMg), 0);
  const scrap = s.scrap.reduce((sum, x) => sum + buyValue(s.prices, x.assessedKarat, x.recordedWeightMg), 0);
  return products + scrap;
}

export const netWorth = (s: GameState) => totalMoney(s) + inventoryValue(s);

export function listPrice(prices: DayPrices, product: Pick<Product, 'karat' | 'weightMg' | 'laborFee'>): number {
  return sellValue(prices, product.karat, product.weightMg) + product.laborFee;
}

export function adjustReputation(s: GameState, delta: number): GameState {
  const reputation = Math.max(0, Math.min(100, s.shop.reputation + delta));
  return { ...s, shop: { ...s.shop, reputation } };
}

function addMoney(s: GameState, account: MoneyAccount, amount: number): GameState {
  return { ...s, shop: { ...s.shop, [account]: s.shop[account] + amount } };
}

export function canPay(s: GameState, account: MoneyAccount, amount: number): boolean {
  return amount <= 0 || s.shop[account] >= amount;
}

const accountOf = (m: PayMethod): MoneyAccount => (m === 'cash' ? 'cash' : 'bank');

function pushTx(s: GameState, tx: Omit<Transaction, 'id' | 'day'>): GameState {
  const [id, s2] = nextId(s, 'GD');
  return { ...s2, transactions: [...s2.transactions, { ...tx, id, day: s2.day }] };
}

/** Pay from bank first, then cash. Returns null if the shop can't afford it. */
function payFromFunds(s: GameState, amount: number): { state: GameState; account: MoneyAccount } | null {
  if (s.shop.bank >= amount) return { state: addMoney(s, 'bank', -amount), account: 'bank' };
  if (s.shop.cash >= amount) return { state: addMoney(s, 'cash', -amount), account: 'cash' };
  return null;
}

/* ───────────── new game / days ───────────── */

function emptyStats(day: number, s: { shop: Shop }, netWorthStart: number): DayStats {
  return {
    day, revenue: 0, cogs: 0, buybackSpend: 0, refineProceeds: 0, refineCost: 0, expenses: 0,
    customersServed: 0, customersLost: 0, reputationStart: s.shop.reputation, netWorthStart,
  };
}

const STARTER_STOCK: [string, number][] = [
  ['nhan-1chi', 4], ['nhan-2chi', 2], ['nhan-5chi', 1], ['mat-than-tai', 2],
  ['nhan-cuoi-18k', 3], ['day-chuyen-18k', 1], ['lac-tay-18k', 1], ['bong-tai-14k', 1],
];

export function newGame(seed: number): GameState {
  const prices = makeDayPrices(1, START_SPOT, null);
  let s: GameState = {
    version: SAVE_VERSION, seed, day: 1, phase: 'morning',
    shop: { cash: 120_000_000, bank: STARTING_CAPITAL - 120_000_000, reputation: 50, level: 1 },
    upgrades: { scalePro: false, ledSign: false, showcase: false, xrf: false },
    products: [], scrap: [], prices,
    priceHistory: [{ day: 1, spot: START_SPOT }],
    transactions: [],
    today: emptyStats(1, { shop: { cash: 0, bank: 0, reputation: 50, level: 1 } }, 0),
    reports: [], customers: [], customerIndex: 0, nextId: 1,
  };
  // Starter stock is bought out of the 500M starting capital.
  for (const [tid, qty] of STARTER_STOCK) {
    const r = restock(s, tid, qty, true);
    if (r) s = r;
  }
  s = { ...s, transactions: s.transactions.map((t) => ({ ...t, description: `Hàng khai trương: ${t.description}` })) };
  s = { ...s, today: emptyStats(1, s, netWorth(s)) };
  return { ...s, customers: generateDayCustomers(s) };
}

export function generateDayCustomers(s: GameState): Customer[] {
  const rng = dayRng(s, 1);
  const count = customersForDay(s.shop.level, s.shop.reputation, s.upgrades.ledSign, s.prices.event?.customerBonus ?? 0);
  const ctx = { day: s.day, level: s.shop.level, reputation: s.shop.reputation, prices: s.prices, products: s.products };
  return Array.from({ length: count }, (_, i) =>
    generateCustomer(rng, `KH${s.day}-${i + 1}`, ctx, s.prices.event?.buyBias ?? 0),
  );
}

export function openShop(s: GameState): GameState {
  return { ...s, phase: 'open' };
}

export function customerDone(s: GameState, served: boolean): GameState {
  const today = { ...s.today };
  if (served) today.customersServed++;
  else today.customersLost++;
  return { ...s, today, customerIndex: s.customerIndex + 1 };
}

export function closeDay(s: GameState): { state: GameState; report: DayReport } {
  const expense = DAILY_EXPENSE[s.shop.level] ?? DAILY_EXPENSE[1];
  let st = addMoney(s, 'bank', -expense);
  st = pushTx(st, { kind: 'expense', description: 'Chi phí mặt bằng, điện, nhân công', amount: -expense, account: 'bank', revenue: 0, cogs: 0 });
  st = { ...st, today: { ...st.today, expenses: st.today.expenses + expense } };

  let leveledUp = false;
  if (st.shop.level === 1 && st.shop.reputation >= LEVEL2_REQUIREMENT.reputation && netWorth(st) >= LEVEL2_REQUIREMENT.netWorth) {
    st = { ...st, shop: { ...st.shop, level: 2 } };
    leveledUp = true;
  }
  const t = st.today;
  const report: DayReport = {
    ...t,
    grossProfit: t.revenue - t.cogs + t.refineProceeds - t.refineCost,
    netWorthEnd: netWorth(st),
    reputationEnd: st.shop.reputation,
    cash: st.shop.cash,
    bank: st.shop.bank,
    inventoryValue: inventoryValue(st),
    leveledUp,
  };
  const phase: Phase = totalMoney(st) < 0 ? 'bankrupt' : 'report';
  return { state: { ...st, phase, reports: [...st.reports, report] }, report };
}

export function startNextDay(s: GameState): GameState {
  const day = s.day + 1;
  const rng = mulberry32(hashSeed(s.seed, day, 0));
  const event = rollEvent(rng);
  const spot = nextSpot(s.prices.spot, rng, event);
  let st: GameState = {
    ...s, day, phase: 'morning',
    prices: makeDayPrices(day, spot, event),
    priceHistory: [...s.priceHistory, { day, spot }].slice(-30),
    customerIndex: 0,
    // Keep the ledger bounded in the save file.
    transactions: s.transactions.filter((t) => t.day > day - 7),
  };
  st = { ...st, today: emptyStats(day, st, netWorth(st)) };
  return { ...st, customers: generateDayCustomers(st) };
}

/* ───────────── trading ───────────── */

export interface SaleInput {
  customer: Customer;
  productId: string;
  price: number;
  method: PayMethod;
  recordedWeightMg: number;
}

function saleLine(s: GameState, p: Product, recordedWeightMg: number, price: number): InvoiceLine {
  return {
    label: p.name, karat: p.karat, weightMg: recordedWeightMg,
    pricePerChi: s.prices.table[p.karat].sell, laborFee: p.laborFee, amount: price, direction: 1,
  };
}

export function applySale(s: GameState, input: SaleInput): GameState {
  const product = s.products.find((p) => p.id === input.productId);
  if (!product) throw new Error('Sản phẩm không còn trong kho');
  let st: GameState = { ...s, products: s.products.filter((p) => p.id !== product.id) };
  st = addMoney(st, accountOf(input.method), input.price);
  st = { ...st, today: { ...st.today, revenue: st.today.revenue + input.price, cogs: st.today.cogs + product.cost } };
  return pushTx(st, {
    kind: 'sale', description: `Bán ${product.name}`, customerName: input.customer.name,
    amount: input.price, account: accountOf(input.method), method: input.method,
    revenue: input.price, cogs: product.cost, lines: [saleLine(s, product, input.recordedWeightMg, input.price)],
  });
}

export interface BuybackInput {
  customer: Customer;
  oldGold: OldGold;
  assessedKarat: Karat;
  recordedWeightMg: number;
  price: number;
  method: PayMethod;
}

function addScrap(s: GameState, input: Omit<BuybackInput, 'method'>): GameState {
  const [id, st] = nextId(s, 'VC');
  const item: ScrapItem = {
    id, name: input.oldGold.name, trueKarat: input.oldGold.trueKarat, weightMg: input.oldGold.weightMg,
    assessedKarat: input.assessedKarat, recordedWeightMg: input.recordedWeightMg, cost: input.price, acquiredDay: s.day,
  };
  return { ...st, scrap: [...st.scrap, item] };
}

function buybackLine(s: GameState, input: Omit<BuybackInput, 'method'>): InvoiceLine {
  const k = input.assessedKarat;
  return {
    label: `Thu mua ${input.oldGold.name.toLowerCase()}`, karat: k, weightMg: input.recordedWeightMg,
    pricePerChi: k === 'FAKE' ? 0 : s.prices.table[k].buy, laborFee: 0, amount: input.price, direction: -1,
  };
}

export function applyBuyback(s: GameState, input: BuybackInput): GameState {
  const account = accountOf(input.method);
  if (!canPay(s, account, input.price)) throw new Error('Không đủ tiền để thanh toán');
  let st = addMoney(s, account, -input.price);
  st = addScrap(st, input);
  st = { ...st, today: { ...st.today, buybackSpend: st.today.buybackSpend + input.price } };
  return pushTx(st, {
    kind: 'buyback', description: `Thu mua ${input.oldGold.name.toLowerCase()}`, customerName: input.customer.name,
    amount: -input.price, account, method: input.method, revenue: 0, cogs: 0, lines: [buybackLine(s, input)],
  });
}

export interface ExchangeInput {
  customer: Customer;
  productId: string;
  newPrice: number;
  newRecordedWeightMg: number;
  oldGold: OldGold;
  assessedKarat: Karat;
  oldRecordedWeightMg: number;
  oldPrice: number;
  method: PayMethod;
}

/** Net = newPrice − oldPrice. Positive: customer pays the difference; negative: the shop pays. */
export function applyExchange(s: GameState, input: ExchangeInput): GameState {
  const product = s.products.find((p) => p.id === input.productId);
  if (!product) throw new Error('Sản phẩm không còn trong kho');
  const net = input.newPrice - input.oldPrice;
  const account = accountOf(input.method);
  if (!canPay(s, account, -net)) throw new Error('Không đủ tiền để bù chênh lệch');
  let st: GameState = { ...s, products: s.products.filter((p) => p.id !== product.id) };
  st = addMoney(st, account, net);
  const scrapInput = { customer: input.customer, oldGold: input.oldGold, assessedKarat: input.assessedKarat, recordedWeightMg: input.oldRecordedWeightMg, price: input.oldPrice };
  st = addScrap(st, scrapInput);
  // The traded-in gold is treated as a purchase paid with the old item.
  st = {
    ...st,
    today: {
      ...st.today,
      revenue: st.today.revenue + input.newPrice,
      cogs: st.today.cogs + product.cost,
      buybackSpend: st.today.buybackSpend + input.oldPrice,
    },
  };
  return pushTx(st, {
    kind: 'exchange', description: `Đổi ${input.oldGold.name.toLowerCase()} lấy ${product.name}`, customerName: input.customer.name,
    amount: net, account, method: input.method, revenue: input.newPrice, cogs: product.cost,
    lines: [saleLine(s, product, input.newRecordedWeightMg, input.newPrice), buybackLine(s, scrapInput)],
  });
}

/* ───────────── back office ───────────── */

export function restockUnitCost(prices: DayPrices, templateId: string, weightMg: number): number {
  const t = TEMPLATE_BY_ID[templateId];
  return wholesaleMetalCost(prices, t.karat, weightMg) + t.laborCost;
}

/** Estimated per-unit cost at the template's base weight (for the shop screen). */
export function restockQuote(prices: DayPrices, templateId: string): number {
  return restockUnitCost(prices, templateId, TEMPLATE_BY_ID[templateId].baseWeightMg);
}

export function restock(s: GameState, templateId: string, qty: number, ignoreLevel = false): GameState | null {
  const t = TEMPLATE_BY_ID[templateId];
  if (!t || qty <= 0 || (!ignoreLevel && t.minLevel > s.shop.level)) return null;
  const rng = dayRng(s, 1000 + s.nextId);
  let st = s;
  const items: Product[] = [];
  let total = 0;
  for (let i = 0; i < qty; i++) {
    const weightMg = rollWeight(rng, t);
    const cost = restockUnitCost(s.prices, templateId, weightMg);
    const [id, next] = nextId(st, 'SP');
    st = next;
    items.push({ id, templateId, name: t.name, karat: t.karat as TradedKarat, weightMg, laborFee: t.laborFee, cost, acquiredDay: s.day });
    total += cost;
  }
  const paid = payFromFunds(st, total);
  if (!paid) return null;
  st = { ...paid.state, products: [...paid.state.products, ...items] };
  return pushTx(st, { kind: 'restock', description: `Nhập ${qty} × ${t.name}`, amount: -total, account: paid.account, revenue: 0, cogs: 0 });
}

export interface RefineResult { state: GameState; proceeds: number; cost: number; fakeCount: number }

export function refineScrap(s: GameState, ids: string[]): RefineResult {
  const chosen = s.scrap.filter((x) => ids.includes(x.id));
  const proceeds = chosen.reduce((sum, x) => sum + refineValue(s.prices, x.trueKarat, x.weightMg), 0);
  const cost = chosen.reduce((sum, x) => sum + x.cost, 0);
  let st: GameState = { ...s, scrap: s.scrap.filter((x) => !ids.includes(x.id)) };
  st = addMoney(st, 'bank', proceeds);
  st = { ...st, today: { ...st.today, refineProceeds: st.today.refineProceeds + proceeds, refineCost: st.today.refineCost + cost } };
  st = pushTx(st, { kind: 'refine', description: `Bán ${chosen.length} món vàng cũ cho xưởng nấu`, amount: proceeds, account: 'bank', revenue: 0, cogs: 0 });
  return { state: st, proceeds, cost, fakeCount: chosen.filter((x) => x.trueKarat === 'FAKE').length };
}

export function buyUpgrade(s: GameState, id: UpgradeId): GameState | null {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u || s.upgrades[id] || u.minLevel > s.shop.level) return null;
  const paid = payFromFunds(s, u.price);
  if (!paid) return null;
  const st = { ...paid.state, upgrades: { ...paid.state.upgrades, [id]: true } };
  return pushTx(st, { kind: 'upgrade', description: `Nâng cấp: ${u.name}`, amount: -u.price, account: paid.account, revenue: 0, cogs: 0 });
}

/** Deposit cash into the bank (positive) or withdraw (negative). */
export function moveFunds(s: GameState, toBank: number): GameState | null {
  if (toBank === 0) return s;
  if (toBank > 0 ? s.shop.cash < toBank : s.shop.bank < -toBank) return null;
  return { ...s, shop: { ...s.shop, cash: s.shop.cash - toBank, bank: s.shop.bank + toBank } };
}

export const unlockedTemplates = (s: GameState) => PRODUCT_TEMPLATES.filter((t) => t.minLevel <= s.shop.level);
