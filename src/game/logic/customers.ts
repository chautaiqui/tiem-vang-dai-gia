import type { DayPrices } from './pricing';
import { sellValue } from './pricing';
import { PRODUCT_TEMPLATES, TEMPLATE_BY_ID, rollOldGold, type OldGold, type Product } from './products';
import { chance, pick, pickWeighted, randInt, randRange, type Rng } from './rng';
import { roundTo } from './units';

/** From the customer's point of view: purchase = customer buys, sellback = customer sells old gold. */
export type Intent = 'purchase' | 'sellback' | 'exchange';
export type PayMethod = 'cash' | 'transfer';

export type PersonaId = 'co-lon-tuoi' | 'vo-chong-tre' | 'chu-khach-quen' | 'khach-tich-tru' | 'khach-kho-tinh' | 'khach-vip';

/** Margins are relative over-charge ratios the customer tolerates (see negotiation.ts). */
interface Margins { accept: number; max: number }

export interface Appearance { skin: string; shirt: string; pants: string; hair: string; height: number; companion?: boolean }

export interface Persona {
  id: PersonaId;
  title: string;
  names: string[];
  intents: Partial<Record<Intent, number>>;
  /** Patience drains this many points per second while waiting at the counter (pool = 100). */
  drainPerSec: number;
  margins: Record<'buy' | 'sell', Margins>;
  /** Detects weighing errors in the shop's favour and demands a re-weigh. */
  picky: boolean;
  cashPreference: number;
  budgetMul: [number, number];
  favourite: string[];
  scamChance: number;
  returnProbability: number;
  minReputation: number;
  minLevel: number;
  look: Omit<Appearance, 'height'> & { height: [number, number] };
}

export const PERSONAS: Record<PersonaId, Persona> = {
  'co-lon-tuoi': {
    id: 'co-lon-tuoi', title: 'Cô khách lớn tuổi',
    names: ['Cô Tư', 'Cô Ba Hoa', 'Bà Sáu', 'Cô Bảy Liên', 'Dì Hai Nga'],
    intents: { purchase: 5, sellback: 3, exchange: 2 },
    drainPerSec: 0.55,
    margins: { buy: { accept: -0.025, max: 0.005 }, sell: { accept: -0.005, max: 0.025 } },
    picky: false, cashPreference: 0.9, budgetMul: [1.02, 1.3],
    favourite: ['nhan-1chi', 'nhan-2chi', 'mat-than-tai', 'lac-tay-18k'],
    scamChance: 0, returnProbability: 0.7, minReputation: 0, minLevel: 1,
    look: { skin: '#e2b48f', shirt: '#9b3d5a', pants: '#3b2f4a', hair: '#cfcfcf', height: [1.5, 1.58] },
  },
  'vo-chong-tre': {
    id: 'vo-chong-tre', title: 'Đôi vợ chồng trẻ',
    names: ['Anh Minh & chị Lan', 'Anh Tuấn & chị Vy', 'Anh Khoa & chị Thảo', 'Anh Phúc & chị My'],
    intents: { purchase: 9, exchange: 1 },
    drainPerSec: 0.6,
    margins: { buy: { accept: -0.005, max: 0.03 }, sell: { accept: 0, max: 0.03 } },
    picky: false, cashPreference: 0.3, budgetMul: [1.05, 1.4],
    favourite: ['nhan-cuoi-18k', 'nhan-cuoi-18k', 'nhan-2chi', 'day-chuyen-18k', 'bong-tai-14k'],
    scamChance: 0, returnProbability: 0.5, minReputation: 0, minLevel: 1,
    look: { skin: '#f0c9a4', shirt: '#2f6fb3', pants: '#24324a', hair: '#1b1410', height: [1.62, 1.74], companion: true },
  },
  'chu-khach-quen': {
    id: 'chu-khach-quen', title: 'Chú khách quen',
    names: ['Chú Sáu', 'Chú Năm Lộc', 'Chú Hai Bình', 'Chú Tám'],
    intents: { sellback: 6, exchange: 4 },
    drainPerSec: 0.45,
    margins: { buy: { accept: -0.01, max: 0.015 }, sell: { accept: -0.01, max: 0.02 } },
    picky: false, cashPreference: 0.8, budgetMul: [1.05, 1.3],
    favourite: ['nhan-2chi', 'nhan-5chi'],
    scamChance: 0, returnProbability: 0.85, minReputation: 0, minLevel: 1,
    look: { skin: '#c8956b', shirt: '#5c7a3a', pants: '#3a3a3a', hair: '#6d6d6d', height: [1.62, 1.7] },
  },
  'khach-tich-tru': {
    id: 'khach-tich-tru', title: 'Khách mua tích trữ',
    names: ['Anh Hùng', 'Chị Mai', 'Anh Đạt', 'Chị Ngọc'],
    intents: { purchase: 7, sellback: 3 },
    drainPerSec: 0.7,
    margins: { buy: { accept: -0.002, max: 0.006 }, sell: { accept: 0, max: 0.008 } },
    picky: false, cashPreference: 0.2, budgetMul: [1.01, 1.08],
    favourite: ['nhan-5chi', 'nhan-1luong', 'nhan-2chi'],
    scamChance: 0, returnProbability: 0.6, minReputation: 0, minLevel: 1,
    look: { skin: '#e6b993', shirt: '#2c2c2c', pants: '#1d2633', hair: '#111', height: [1.66, 1.78] },
  },
  'khach-kho-tinh': {
    id: 'khach-kho-tinh', title: 'Khách khó tính',
    names: ['Chị Hằng', 'Anh Lâm', 'Chị Diễm', 'Anh Quang'],
    intents: { purchase: 4, sellback: 4, exchange: 2 },
    drainPerSec: 0.9,
    margins: { buy: { accept: -0.015, max: 0.008 }, sell: { accept: -0.005, max: 0.015 } },
    picky: true, cashPreference: 0.5, budgetMul: [1.02, 1.2],
    favourite: ['nhan-1chi', 'nhan-cuoi-18k', 'bong-tai-14k', 'nhan-da-14k'],
    scamChance: 0.25, returnProbability: 0.4, minReputation: 0, minLevel: 1,
    look: { skin: '#edc3a0', shirt: '#7a2f2f', pants: '#2b2b2b', hair: '#2a1a12', height: [1.58, 1.72] },
  },
  'khach-vip': {
    id: 'khach-vip', title: 'Khách VIP',
    names: ['Bà Năm Kim', 'Ông Lý', 'Chị Thanh Hương', 'Anh Bảo'],
    intents: { purchase: 8, exchange: 2 },
    drainPerSec: 1.2,
    margins: { buy: { accept: 0.005, max: 0.04 }, sell: { accept: 0, max: 0.03 } },
    picky: false, cashPreference: 0.1, budgetMul: [1.2, 2],
    favourite: ['nhan-1luong', 'nhan-5chi', 'day-chuyen-18k', 'lac-tay-18k'],
    scamChance: 0, returnProbability: 0.6, minReputation: 55, minLevel: 1,
    look: { skin: '#f3cfae', shirt: '#b8902f', pants: '#1a1a1a', hair: '#0d0d0d', height: [1.6, 1.75] },
  },
};

export const PERSONA_WEIGHTS: Record<PersonaId, number> = {
  'co-lon-tuoi': 22, 'vo-chong-tre': 16, 'chu-khach-quen': 18, 'khach-tich-tru': 16, 'khach-kho-tinh': 16, 'khach-vip': 12,
};

export interface Customer {
  id: string;
  personaId: PersonaId;
  name: string;
  intent: Intent;
  budget: number;
  /** 0–100; 50 neutral. Shifts tolerated margins. */
  trust: number;
  /** Patience pool at arrival (0–100). */
  patience: number;
  purchaseIntent: number;
  returnProbability: number;
  wantTemplateId?: string;
  oldGold?: OldGold;
  scam: boolean;
  payMethod: PayMethod;
  appearance: Appearance;
}

export interface GenerateContext {
  day: number;
  level: number;
  reputation: number;
  prices: DayPrices;
  products: Product[];
}

export function customersForDay(level: number, reputation: number, ledSign: boolean, eventBonus: number): number {
  const n = 4 + Math.floor(reputation / 20) + (ledSign ? 1 : 0) + (level >= 2 ? 1 : 0) + eventBonus;
  return Math.max(3, Math.min(10, n));
}

function chooseWanted(rng: Rng, persona: Persona, ctx: GenerateContext): string {
  const unlocked = PRODUCT_TEMPLATES.filter((t) => t.minLevel <= ctx.level).map((t) => t.id);
  const inStock = new Set(ctx.products.map((p) => p.templateId));
  const favs = persona.favourite.filter((id) => unlocked.includes(id));
  const favsInStock = favs.filter((id) => inStock.has(id));
  // Mostly ask for something the shop actually has, so the day is playable.
  if (favsInStock.length && chance(rng, 0.85)) return pick(rng, favsInStock);
  const anyInStock = unlocked.filter((id) => inStock.has(id));
  if (anyInStock.length && chance(rng, 0.6)) return pick(rng, anyInStock);
  return pick(rng, favs.length ? favs : unlocked);
}

export function generateCustomer(rng: Rng, id: string, ctx: GenerateContext, buyBias: number): Customer {
  const eligible = (Object.keys(PERSONAS) as PersonaId[]).filter((p) => {
    const persona = PERSONAS[p];
    return ctx.reputation >= persona.minReputation && ctx.level >= persona.minLevel;
  });
  const weights = Object.fromEntries(eligible.map((p) => [p, PERSONA_WEIGHTS[p]])) as Record<PersonaId, number>;
  const persona = PERSONAS[pickWeighted(rng, weights)];

  const intentWeights = { ...persona.intents };
  if (intentWeights.purchase) intentWeights.purchase *= 1 + buyBias;
  if (intentWeights.sellback) intentWeights.sellback *= 1 - buyBias;
  const intent = pickWeighted<Intent>(rng, intentWeights);

  const trust = Math.round(Math.min(100, Math.max(0, ctx.reputation + randInt(rng, -15, 15))));
  const scam = intent !== 'purchase' && chance(rng, persona.scamChance + (ctx.reputation < 40 ? 0.05 : 0));
  const appearance: Appearance = {
    skin: persona.look.skin, shirt: persona.look.shirt, pants: persona.look.pants, hair: persona.look.hair,
    height: randRange(rng, persona.look.height[0], persona.look.height[1]),
    companion: persona.look.companion,
  };

  const customer: Customer = {
    id, personaId: persona.id, name: pick(rng, persona.names), intent,
    budget: 0, trust, patience: 100,
    purchaseIntent: intent === 'sellback' ? 0 : Math.round(randRange(rng, 0.6, 1) * 100) / 100,
    returnProbability: persona.returnProbability,
    scam, payMethod: chance(rng, persona.cashPreference) ? 'cash' : 'transfer',
    appearance,
  };

  if (intent !== 'sellback') {
    customer.wantTemplateId = chooseWanted(rng, persona, ctx);
    const t = TEMPLATE_BY_ID[customer.wantTemplateId];
    const est = sellValue(ctx.prices, t.karat, Math.round(t.baseWeightMg * (1 + t.weightJitter))) + t.laborFee;
    customer.budget = roundTo(est * randRange(rng, persona.budgetMul[0], persona.budgetMul[1]), 100_000);
  }
  if (intent !== 'purchase') customer.oldGold = rollOldGold(rng, scam);
  return customer;
}

/* ───────────────────────── Dialogue ───────────────────────── */

type Line = string | ((c: Customer, item: string) => string);

const GREETINGS: Record<PersonaId, Record<Intent, Line[]>> = {
  'co-lon-tuoi': {
    purchase: [(_, i) => `Em ơi, nay vàng lên xuống sao rồi? Cô muốn mua một ${i}, em lấy cô coi thử.`, (_, i) => `Con ơi, lấy cô cái ${i}. Mà nhớ bớt cho cô chút nghen!`],
    sellback: [(_, i) => `Em ơi, cô bán cái ${i} này, coi giùm cô được bao nhiêu.`, (_, i) => `Cô cần tiền đóng học cho cháu, bán cái ${i} này nè em.`],
    exchange: [(_, i) => `Cô đổi cái món cũ này lấy ${i}, em tính bù trừ cho cô nha.`],
  },
  'vo-chong-tre': {
    purchase: [(_, i) => `Tụi mình sắp cưới, muốn xem ${i}. Chọn giúp tụi mình cái đẹp nha!`, (_, i) => `Chào em, cho tụi anh xem ${i} với.`],
    sellback: [(_, i) => `Tụi mình muốn bán ${i} này.`],
    exchange: [(_, i) => `Bọn mình muốn đổi món vàng cũ của mẹ cho để lấy ${i} làm của cưới.`],
  },
  'chu-khach-quen': {
    purchase: [(_, i) => `Lấy chú ${i}, giá như mọi khi nghen.`],
    sellback: [(_, i) => `Chú bán lại cái ${i} nè. Khách quen, tính giá tốt cho chú nghe!`, (_, i) => `Bữa nay giá sao con? Chú đem cái ${i} qua bán.`],
    exchange: [(_, i) => `Chú đổi món cũ này lấy ${i}, con bù trừ giùm chú.`],
  },
  'khach-tich-tru': {
    purchase: [(_, i) => `Nay ${i} bán bao nhiêu? Chênh lệch mua bán nhiều không em?`, (_, i) => `Cho anh ${i}. Anh tích trữ, giá phải sát bảng nhé.`],
    sellback: [(_, i) => `Giá lên rồi, anh chốt lời. Thu lại ${i} này giá bảng nhé.`],
    exchange: [(_, i) => `Đổi món này lấy ${i}.`],
  },
  'khach-kho-tinh': {
    purchase: [(_, i) => `Cho xem ${i}. Cân kỹ trước mặt tôi nhé, tôi kiểm tra hóa đơn đấy.`],
    sellback: [(_, i) => `Tôi bán ${i}. Cân cho đúng, đừng có ăn gian nghe chưa.`],
    exchange: [(_, i) => `Tôi đổi món này lấy ${i}. Tính cho rõ ràng từng đồng.`],
  },
  'khach-vip': {
    purchase: [(_, i) => `Lấy ${i}. Làm nhanh giúp tôi, tôi có hẹn.`, (_, i) => `Tôi cần ${i} ngay, giá cả không thành vấn đề nếu phục vụ tốt.`],
    sellback: [(_, i) => `Thu ${i} này nhanh giúp tôi.`],
    exchange: [(_, i) => `Đổi món này lấy ${i}, nhanh gọn nhé.`],
  },
};

export function greeting(c: Customer, rng: Rng): string {
  const item =
    c.intent === 'sellback'
      ? c.oldGold!.name.toLowerCase() + (c.oldGold!.claimedKarat !== 'FAKE' ? ` (${claimLabel(c.oldGold!.claimedKarat)})` : '')
      : TEMPLATE_BY_ID[c.wantTemplateId!].name;
  const line = pick(rng, GREETINGS[c.personaId][c.intent]);
  return typeof line === 'string' ? line : line(c, item);
}

function claimLabel(k: OldGold['claimedKarat']): string {
  return k === 'K24' ? 'vàng 9999' : k === 'K18' ? 'vàng 18K' : 'vàng 14K';
}

export const REACTIONS = {
  accept: ['Được, chốt vậy đi!', 'Ừ, giá vậy hợp lý.', 'Ok em, lấy luôn.', 'Vậy là được rồi.'],
  counter: ['Bớt chút đi em, {price} được không?', 'Giá đó hơi cao, {price} thì chốt.', 'Tính {price} cho tròn đi.', 'Thôi {price} nghen, khách quen mà.'],
  counterSell: ['Ít vậy? Ít nhất {price} chứ em.', 'Bảng ghi cao hơn mà, {price} đi.', 'Thêm chút nữa, {price} là tôi bán.'],
  reject: ['Trời, sao mắc dữ vậy!', 'Giá này không được đâu.', 'Không được, xa quá.'],
  rejectSell: ['Ép giá quá vậy em!', 'Vậy thì tôi đi tiệm khác bán.', 'Thấp quá, không bán đâu.'],
  insulted: ['Coi người ta như con nít hả? Bỏ đi!', 'Ăn nói kiểu gì vậy, tôi đi!'],
  budget: ['Tôi không đủ tiền chừng đó đâu, tối đa {price} thôi.'],
  leaveImpatient: ['Thôi, chờ lâu quá, tôi đi tiệm khác.', 'Làm gì lâu vậy, thôi khỏi!'],
  thanks: ['Cảm ơn em nha, bữa sau ghé nữa!', 'Cảm ơn, tiệm làm ăn uy tín ghê.', 'Ok, cảm ơn em!'],
  wrongItem: ['Không phải món này, tôi cần {item} mà.', 'Lấy nhầm rồi em ơi, {item} kìa.'],
  noStock: ['Tiếc ghê, thôi để bữa khác.', 'Hết hàng hả? Vậy thôi.'],
  pickyCaught: ['Khoan! Cân lại coi — số này sai rồi! Làm ăn kiểu gì vậy?', 'Tôi thấy số cân lệch rồi đó, đừng có ăn gian!'],
  scamCaught: ['Ờ... vậy thôi, tôi đi.', 'Ai nói không đạt? Thôi khỏi bán!'],
  wronglyRejected: ['Vàng thật mà em nói không đạt? Tiệm gì kỳ vậy!', 'Đồ nhà tôi để mấy chục năm, sao mà giả được!'],
} as const;

export function say(rng: Rng, key: keyof typeof REACTIONS, vars: Record<string, string> = {}): string {
  let line: string = pick(rng, REACTIONS[key]);
  for (const [k, v] of Object.entries(vars)) line = line.replace(`{${k}}`, v);
  return line;
}
