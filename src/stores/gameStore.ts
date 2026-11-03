import { create } from 'zustand';
import { PERSONAS, greeting, say, type Customer, type PayMethod } from '../game/logic/customers';
import {
  adjustReputation, applyBuyback, applyExchange, applySale, buyUpgrade, closeDay, customerDone, listPrice, moveFunds,
  newGame, openShop, refineScrap, restock, startNextDay, type GameState, type Transaction, type UpgradeId,
} from '../game/logic/game';
import type { Karat } from '../game/logic/gold';
import { evaluateOffer, marginsWithTrust, overchargeRatio, type Terms } from '../game/logic/negotiation';
import { buyValue } from '../game/logic/pricing';
import { TEMPLATE_BY_ID, type Product } from '../game/logic/products';
import { mulberry32, type Rng } from '../game/logic/rng';
import { formatVnd } from '../game/logic/units';
import { OBVIOUS_ERROR_MG, PICKY_TOLERANCE_MG } from '../game/logic/weighing';
import { sfx } from '../services/audio';
import { clearSave, loadGame, saveGame } from '../services/save';

export type Target = 'door' | 'cabinet' | 'scale' | 'inspect' | 'pos' | 'board' | 'safe' | 'customer' | 'altar';
export type Overlay =
  | 'dayStart' | 'cabinet' | 'scale' | 'inspect' | 'pos' | 'payment' | 'invoice'
  | 'board' | 'safe' | 'help' | 'report' | 'bankrupt' | null;

export const TARGET_LABEL: Record<Target, string> = {
  door: 'Cửa tiệm', cabinet: 'Tủ trưng bày', scale: 'Cân vàng', inspect: 'Bộ kiểm định', pos: 'Máy tính tiền',
  board: 'Bảng giá', safe: 'Két sắt', customer: 'Khách hàng', altar: 'Bàn thờ Thần Tài',
};

export interface ChatLine { who: 'shop' | 'customer' | 'system'; text: string }
export type Stage = 'entering' | 'waiting' | 'serving' | 'leaving';

export interface Deal {
  customer: Customer;
  stage: Stage;
  patience: number;
  hasOld: boolean;
  oldWeighedMg: number | null;
  oldAssessed: Karat | null;
  productId: string | null;
  newWeighedMg: number | null;
  round: number;
  counter: number | null;
  lastQuote: { newPrice: number; oldPrice: number } | null;
  agreed: { newPrice: number; oldPrice: number } | null;
  /** Over-charge ratio at the agreed price, computed while the product is still in stock. */
  agreedRatio: number;
  chat: ChatLine[];
  invoice: Transaction | null;
  warned: boolean;
}

export interface DialogChoice { label: string; run: () => void }
export interface Dialog { speaker: string; text: string; choices?: DialogChoice[] }
export interface Toast { id: number; text: string; tone: 'info' | 'good' | 'bad' }

interface Store {
  screen: 'title' | 'game';
  booted: boolean;
  savedGame: GameState | null;
  game: GameState | null;
  overlay: Overlay;
  focus: Target | null;
  pointerLocked: boolean;
  deal: Deal | null;
  dialog: Dialog | null;
  toasts: Toast[];

  boot(): Promise<void>;
  startNew(): void;
  continueGame(): void;
  quitToTitle(): void;

  setFocus(t: Target | null): void;
  setPointerLocked(v: boolean): void;
  openOverlay(o: Overlay): void;
  closeOverlay(): void;
  closeDialog(): void;
  toast(text: string, tone?: Toast['tone']): void;
  interact(t: Target): void;

  spawnNext(): void;
  npcArrived(): void;
  npcLeft(): void;
  tick(dt: number): void;

  pickProduct(id: string): void;
  returnProduct(): void;
  recordWeight(which: 'new' | 'old', mg: number): void;
  assess(k: Karat): void;
  losePatience(points: number): void;
  submitQuote(newPrice: number, oldPrice: number): void;
  acceptCounter(): void;
  refuseFake(): void;
  dismissCustomer(): void;
  confirmPayment(method: PayMethod): void;
  finishInvoice(): void;

  doRestock(templateId: string, qty: number): void;
  doRefine(ids: string[]): void;
  doUpgrade(id: UpgradeId): void;
  doMoveFunds(toBank: number): void;
  nextDay(): void;
}

/* Pointer lock is owned by the Player component; the store just asks for it. */
let lockPointer: () => void = () => {};
export const registerPointerLock = (fn: () => void) => { lockPointer = fn; };

let rng: Rng = mulberry32(Date.now() >>> 0);
let toastSeq = 0;

const persist = (g: GameState | null) => { if (g) void saveGame(g).catch(() => {}); };

export function dealProduct(game: GameState, deal: Deal): Product | undefined {
  return deal.productId ? game.products.find((p) => p.id === deal.productId) : undefined;
}

/** How the customer judges the deal — always from TRUE weights and the karat they believe in. */
export function dealTerms(game: GameState, deal: Deal): Terms {
  const c = deal.customer;
  const persona = PERSONAS[c.personaId];
  const repShift = (game.shop.reputation - 50) / 4000;
  const kind = c.intent === 'sellback' ? 'sell' : 'buy';
  let { accept, max } = marginsWithTrust(persona.margins[kind].accept, persona.margins[kind].max, c.trust);
  accept += repShift;
  max += repShift;
  if (c.scam) { accept += 0.04; max += 0.08; } // a scammer is in a hurry to unload
  const product = dealProduct(game, deal);
  const fairNew = product ? listPrice(game.prices, product) : 0;
  const fairOld = c.oldGold ? buyValue(game.prices, c.oldGold.claimedKarat, c.oldGold.weightMg) : 0;
  if (c.intent === 'purchase') return { intent: 'purchase', fair: fairNew, base: fairNew, accept, max, budget: c.budget };
  if (c.intent === 'sellback') return { intent: 'sellback', fair: fairOld, base: fairOld, accept, max };
  return { intent: 'exchange', fair: fairNew - fairOld, base: Math.max(fairNew, fairOld), accept, max, budget: c.budget };
}

export const quoteValue = (intent: Customer['intent'], q: { newPrice: number; oldPrice: number }) =>
  intent === 'purchase' ? q.newPrice : intent === 'sellback' ? q.oldPrice : q.newPrice - q.oldPrice;

export function missingSteps(game: GameState, deal: Deal): string[] {
  const c = deal.customer;
  const out: string[] = [];
  if (c.intent !== 'purchase') {
    if (!deal.hasOld) out.push('Nhận món vàng cũ từ khách');
    else {
      if (deal.oldWeighedMg === null) out.push('Cân món vàng cũ');
      if (deal.oldAssessed === null) out.push('Kiểm định tuổi vàng');
    }
  }
  if (c.intent !== 'sellback') {
    if (!dealProduct(game, deal)) out.push('Lấy sản phẩm từ tủ trưng bày');
    else if (deal.newWeighedMg === null) out.push('Cân sản phẩm mới');
  }
  return out;
}

export function objective(s: Pick<Store, 'game' | 'deal' | 'overlay'>): string {
  const { game, deal } = s;
  if (!game) return '';
  if (game.phase === 'morning') return 'Quay về phía cửa ra vào (trước mặt quầy), nhìn vào cửa và bấm E để mở cửa đón khách.';
  if (game.phase !== 'open') return '';
  if (!deal) {
    return game.customerIndex >= game.customers.length
      ? 'Hết khách hôm nay. Nhìn vào cửa ra vào, bấm E để đóng cửa và xem báo cáo.'
      : 'Đang chờ khách tiếp theo…';
  }
  if (deal.stage === 'entering') return 'Khách đang bước vào tiệm…';
  if (deal.stage === 'leaving') return 'Khách đang rời tiệm.';
  if (deal.stage === 'waiting') return 'Nhìn vào khách và bấm E để tiếp chuyện.';
  const missing = missingSteps(game, deal);
  if (missing.length) {
    const m = missing[0];
    if (m.startsWith('Nhận')) return 'Bấm E vào khách để nhận món vàng cũ.';
    if (m.startsWith('Lấy')) return 'Tới TỦ TRƯNG BÀY phía sau, lấy món khách cần.';
    if (m.startsWith('Cân')) return `${m}: tới BÀN CÂN (bên trái quầy).`;
    if (m.startsWith('Kiểm')) return 'Kiểm định tuổi vàng tại BỘ KIỂM ĐỊNH (cạnh bàn cân).';
  }
  return 'Tới MÁY TÍNH TIỀN để báo giá và chốt giao dịch.';
}

const salutation = (c: Customer) => (c.personaId === 'co-lon-tuoi' ? 'cô' : c.personaId === 'chu-khach-quen' ? 'chú' : 'anh chị');

export const useGame = create<Store>((set, get) => {
  const updateDeal = (patch: Partial<Deal>) => {
    const d = get().deal;
    if (d) set({ deal: { ...d, ...patch } });
  };

  const addChat = (who: ChatLine['who'], text: string) => {
    const d = get().deal;
    if (d) set({ deal: { ...d, chat: [...d.chat, { who, text }] } });
  };

  /** Customer says a final line and walks out. */
  const customerLeaves = (served: boolean, repDelta: number, line: string) => {
    const { game, deal } = get();
    if (!game || !deal || deal.stage === 'leaving') return;
    let g = customerDone(game, served);
    if (repDelta) g = adjustReputation(g, repDelta);
    set({
      game: g,
      deal: { ...deal, stage: 'leaving' },
      overlay: null,
      dialog: { speaker: deal.customer.name, text: line },
    });
    if (repDelta) get().toast(`Uy tín ${repDelta > 0 ? '+' : ''}${repDelta}`, repDelta > 0 ? 'good' : 'bad');
    persist(g);
    lockPointer();
  };

  const greetingChoices = (c: Customer): DialogChoice[] => {
    const close = () => get().closeDialog();
    const decline = (text: string) => () => {
      addChat('shop', text);
      customerLeaves(false, -1, say(rng, 'noStock'));
    };
    if (c.intent === 'purchase') {
      return [
        { label: `Dạ, ${salutation(c)} chờ em lấy hàng ạ.`, run: close },
        { label: 'Dạ, món này tiệm hết hàng rồi ạ.', run: decline('Xin lỗi, món này hết hàng.') },
      ];
    }
    const receive = () => {
      updateDeal({ hasOld: true });
      get().toast(`Đã nhận: ${c.oldGold!.name}`, 'info');
      sfx.click();
      close();
    };
    return [
      { label: c.intent === 'sellback' ? 'Dạ, đưa em xem món vàng ạ.' : 'Dạ, đưa em món cũ, em lấy hàng mới cho.', run: receive },
      { label: c.intent === 'sellback' ? 'Dạ, hôm nay tiệm không thu mua.' : 'Dạ, hôm nay tiệm không nhận đổi.', run: decline('Xin lỗi, hôm nay tiệm không nhận.') },
    ];
  };

  const talk = () => {
    const { deal, game } = get();
    if (!deal || !game) return;
    const c = deal.customer;
    if (deal.stage === 'entering') return get().toast('Khách đang bước vào…');
    if (deal.stage === 'leaving') return;
    document.exitPointerLock?.();
    if (deal.stage === 'waiting') {
      const text = greeting(c, rng);
      set({ deal: { ...deal, stage: 'serving', chat: [{ who: 'customer', text }] }, dialog: { speaker: c.name, text, choices: greetingChoices(c) } });
      return;
    }
    if (c.intent !== 'purchase' && !deal.hasOld) {
      set({ dialog: { speaker: c.name, text: `Món ${c.oldGold!.name.toLowerCase()} đây em.`, choices: greetingChoices(c) } });
      return;
    }
    const want = c.wantTemplateId ? TEMPLATE_BY_ID[c.wantTemplateId].name : c.oldGold!.name;
    set({
      dialog: {
        speaker: c.name,
        text: c.intent === 'sellback' ? `Sao rồi em, cái ${want.toLowerCase()} được bao nhiêu?` : `Em lấy giùm ${want} nha.`,
        choices: [
          { label: 'Dạ, em làm ngay ạ.', run: () => get().closeDialog() },
          { label: `Xin lỗi, mời ${salutation(c)} về ạ.`, run: () => get().dismissCustomer() },
        ],
      },
    });
  };

  return {
    screen: 'title',
    booted: false,
    savedGame: null,
    game: null,
    overlay: null,
    focus: null,
    pointerLocked: false,
    deal: null,
    dialog: null,
    toasts: [],

    async boot() {
      const saved = await loadGame();
      set({ savedGame: saved, booted: true });
    },

    startNew() {
      void clearSave().catch(() => {});
      const g = newGame((Math.random() * 2 ** 31) >>> 0);
      rng = mulberry32(g.seed ^ 0x9e3779b9);
      set({ screen: 'game', game: g, deal: null, dialog: null, overlay: 'dayStart', savedGame: null });
      persist(g);
    },

    continueGame() {
      const g = get().savedGame;
      if (!g) return;
      rng = mulberry32((g.seed ^ g.day ^ Date.now()) >>> 0);
      const overlay: Overlay = g.phase === 'report' ? 'report' : g.phase === 'bankrupt' ? 'bankrupt' : g.phase === 'morning' ? 'dayStart' : null;
      set({ screen: 'game', game: g, deal: null, dialog: null, overlay });
      if (g.phase === 'open') setTimeout(() => get().spawnNext(), 800);
    },

    quitToTitle() {
      persist(get().game);
      document.exitPointerLock?.();
      set({ screen: 'title', savedGame: get().game, game: null, deal: null, overlay: null, dialog: null });
    },

    setFocus: (t) => { if (get().focus !== t) set({ focus: t }); },
    setPointerLocked: (v) => set({ pointerLocked: v }),

    openOverlay(o) {
      document.exitPointerLock?.();
      set({ overlay: o, dialog: null });
    },

    closeOverlay() {
      const { overlay } = get();
      if (overlay === 'payment' || overlay === 'invoice' || overlay === 'report' || overlay === 'bankrupt') return;
      set({ overlay: null });
      lockPointer();
    },

    closeDialog() {
      set({ dialog: null });
      if (!get().overlay) lockPointer();
    },

    toast(text, tone = 'info') {
      const id = ++toastSeq;
      set({ toasts: [...get().toasts.slice(-3), { id, text, tone }] });
      setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 3200);
    },

    interact(t) {
      const { game, deal } = get();
      if (!game || get().overlay) return;
      sfx.click();
      switch (t) {
        case 'door': {
          if (game.phase === 'morning') {
            const g = openShop(game);
            set({ game: g });
            persist(g);
            get().toast('Tiệm đã mở cửa! Bật đèn, chờ khách…', 'good');
            setTimeout(() => get().spawnNext(), 1500);
          } else if (game.phase === 'open') {
            if (deal || game.customerIndex < game.customers.length) {
              get().toast(`Còn ${game.customers.length - game.customerIndex} khách trong ngày, chưa đóng cửa được.`, 'bad');
            } else {
              const { state } = closeDay(game);
              set({ game: state, overlay: state.phase === 'bankrupt' ? 'bankrupt' : 'report' });
              document.exitPointerLock?.();
              persist(state);
            }
          }
          return;
        }
        case 'customer': return talk();
        case 'cabinet': return get().openOverlay('cabinet');
        case 'board': return get().openOverlay('board');
        case 'safe': return get().openOverlay('safe');
        case 'altar': return get().toast('Thắp nén nhang cầu buôn may bán đắt 🙏', 'good');
        case 'scale':
          if (!deal || deal.stage !== 'serving' || (!deal.productId && !deal.hasOld)) return get().toast('Chưa có món vàng nào cần cân.', 'bad');
          return get().openOverlay('scale');
        case 'inspect':
          if (!deal?.hasOld || deal.stage !== 'serving') return get().toast('Chưa có món vàng cũ nào cần kiểm định.', 'bad');
          return get().openOverlay('inspect');
        case 'pos':
          if (!deal || deal.stage !== 'serving') return get().toast('Chưa có giao dịch nào. Hãy tiếp chuyện khách trước.', 'bad');
          return get().openOverlay('pos');
      }
    },

    spawnNext() {
      const { game, deal } = get();
      if (!game || deal || game.phase !== 'open' || game.customerIndex >= game.customers.length) return;
      const customer = game.customers[game.customerIndex];
      set({
        deal: {
          customer, stage: 'entering', patience: customer.patience, hasOld: false, oldWeighedMg: null, oldAssessed: null,
          productId: null, newWeighedMg: null, round: 0, counter: null, lastQuote: null, agreed: null, agreedRatio: 0, chat: [], invoice: null, warned: false,
        },
      });
      sfx.chime();
    },

    npcArrived() {
      const d = get().deal;
      if (d?.stage !== 'entering') return;
      updateDeal({ stage: 'waiting' });
      get().toast(`${d.customer.name} đã tới quầy — nhìn vào khách, bấm E.`);
    },

    npcLeft() {
      const g = get().game;
      set({ deal: null, dialog: get().dialog?.choices ? get().dialog : null });
      if (g && g.customerIndex < g.customers.length) setTimeout(() => get().spawnNext(), 1800);
      else if (g) get().toast('Đã hết khách. Ra cửa bấm E để đóng cửa.', 'good');
    },

    tick(dt) {
      const { deal, game, overlay, pointerLocked } = get();
      if (!deal || !game || (deal.stage !== 'waiting' && deal.stage !== 'serving')) return;
      if (overlay === 'help' || overlay === 'payment' || overlay === 'invoice') return;
      if (!pointerLocked && !overlay && !get().dialog) return; // player tabbed away / paused
      const drain = PERSONAS[deal.customer.personaId].drainPerSec * (game.upgrades.showcase ? 0.75 : 1);
      const patience = deal.patience - drain * dt;
      if (patience <= 0) return customerLeaves(false, -2, say(rng, 'leaveImpatient'));
      if (patience < 30 && !deal.warned) {
        get().toast(`${deal.customer.name} bắt đầu sốt ruột!`, 'bad');
        set({ deal: { ...deal, patience, warned: true } });
      } else set({ deal: { ...deal, patience } });
    },

    pickProduct(id) {
      updateDeal({ productId: id, newWeighedMg: null });
      sfx.click();
    },

    returnProduct() {
      updateDeal({ productId: null, newWeighedMg: null });
    },

    recordWeight(which, mg) {
      updateDeal(which === 'new' ? { newWeighedMg: mg } : { oldWeighedMg: mg });
    },

    assess(k) {
      updateDeal({ oldAssessed: k });
    },

    losePatience(points) {
      const d = get().deal;
      if (d) updateDeal({ patience: Math.max(1, d.patience - points) });
    },

    submitQuote(newPrice, oldPrice) {
      const { game, deal } = get();
      if (!game || !deal) return;
      const c = deal.customer;
      const persona = PERSONAS[c.personaId];
      const product = dealProduct(game, deal);
      if (missingSteps(game, deal).length) return get().toast('Chưa đủ bước để báo giá.', 'bad');

      // 1. Wrong product?
      if (product && c.wantTemplateId && product.templateId !== c.wantTemplateId) {
        addChat('customer', say(rng, 'wrongItem', { item: TEMPLATE_BY_ID[c.wantTemplateId].name }));
        updateDeal({ productId: null, newWeighedMg: null, patience: Math.max(1, get().deal!.patience - 15) });
        sfx.error();
        return;
      }

      // 2. Weighing honesty — only errors in the shop's favour upset customers.
      const errors: number[] = [];
      if (product && deal.newWeighedMg !== null) errors.push(deal.newWeighedMg - product.weightMg);
      if (c.oldGold && deal.oldWeighedMg !== null) errors.push(c.oldGold.weightMg - deal.oldWeighedMg);
      const worst = Math.max(0, ...errors);
      const caught = (persona.picky && worst > PICKY_TOLERANCE_MG) || (worst > OBVIOUS_ERROR_MG && rng() < 0.7);
      if (caught) {
        addChat('customer', say(rng, 'pickyCaught'));
        set({ game: adjustReputation(game, -5) });
        updateDeal({ newWeighedMg: product ? null : deal.newWeighedMg, oldWeighedMg: c.oldGold ? null : deal.oldWeighedMg, patience: Math.max(1, deal.patience - 25) });
        get().toast('Khách phát hiện cân sai! Uy tín -5. Hãy cân lại.', 'bad');
        sfx.error();
        return;
      }

      // 3. A scammer whose trick was seen through just leaves.
      if (c.scam && c.oldGold && deal.oldAssessed === c.oldGold.trueKarat) {
        addChat('shop', 'Món này không đúng tuổi vàng như lời khách nói.');
        return customerLeaves(false, 2, say(rng, 'scamCaught'));
      }

      const terms = dealTerms(game, deal);
      const q = { newPrice, oldPrice };
      const value = quoteValue(c.intent, q);
      addChat('shop', c.intent === 'exchange'
        ? `Món mới ${formatVnd(newPrice)}, thu món cũ ${formatVnd(oldPrice)} → ${value >= 0 ? `${salutation(c)} bù` : 'tiệm trả'} ${formatVnd(Math.abs(value))}.`
        : `Dạ, giá ${formatVnd(value)} ạ.`);
      const verdict = evaluateOffer(terms, value, deal.round, rng);
      const d = get().deal!;
      if (verdict.type === 'accept') {
        addChat('customer', say(rng, 'accept'));
        set({ deal: { ...get().deal!, agreed: q, agreedRatio: overchargeRatio(terms, value), lastQuote: q, round: d.round + 1 }, overlay: 'payment' });
        sfx.success();
        return;
      }
      if (verdict.type === 'counter') {
        const key = c.intent === 'sellback' ? 'counterSell' : 'counter';
        addChat('customer', say(rng, key, { price: formatVnd(verdict.price) }));
        updateDeal({ counter: verdict.price, lastQuote: q, round: d.round + 1, patience: Math.max(1, d.patience - 6) });
        return;
      }
      if (verdict.insulted) {
        addChat('customer', say(rng, 'insulted'));
        return customerLeaves(false, -3, say(rng, 'insulted'));
      }
      const line = verdict.overBudget
        ? say(rng, 'budget', { price: formatVnd(verdict.price) })
        : `${say(rng, c.intent === 'sellback' ? 'rejectSell' : 'reject')} ${formatVnd(verdict.price)} thì được.`;
      addChat('customer', line);
      sfx.error();
      const patience = d.patience - 15;
      if (patience <= 0) return customerLeaves(false, -2, say(rng, 'leaveImpatient'));
      updateDeal({ counter: verdict.price, lastQuote: q, round: d.round + 1, patience });
    },

    acceptCounter() {
      const d = get().deal;
      if (!d || d.counter === null || !d.lastQuote) return;
      const c = d.customer;
      const q = c.intent === 'purchase'
        ? { newPrice: d.counter, oldPrice: 0 }
        : c.intent === 'sellback'
          ? { newPrice: 0, oldPrice: d.counter }
          : { newPrice: d.counter + d.lastQuote.oldPrice, oldPrice: d.lastQuote.oldPrice };
      if (c.intent === 'exchange' && q.newPrice < 0) return get().toast('Giá khách đề nghị không hợp lệ.', 'bad');
      addChat('shop', `Dạ, em chốt ${formatVnd(d.counter)} cho ${salutation(c)}.`);
      addChat('customer', say(rng, 'accept'));
      const g = get().game!;
      const ratio = overchargeRatio(dealTerms(g, d), quoteValue(c.intent, q));
      set({ deal: { ...get().deal!, agreed: q, agreedRatio: ratio }, overlay: 'payment' });
      sfx.success();
    },

    refuseFake() {
      const { deal } = get();
      if (!deal?.customer.oldGold) return;
      const genuine = deal.customer.oldGold.trueKarat !== 'FAKE';
      addChat('shop', 'Xin lỗi, món này không đạt, tiệm không thu được.');
      if (genuine) customerLeaves(false, -4, say(rng, 'wronglyRejected'));
      else customerLeaves(false, 2, say(rng, 'scamCaught'));
    },

    dismissCustomer() {
      customerLeaves(false, -1, say(rng, 'noStock'));
    },

    confirmPayment(method) {
      const { game, deal } = get();
      if (!game || !deal?.agreed) return;
      const c = deal.customer;
      const a = deal.agreed;
      try {
        let g: GameState;
        if (c.intent === 'purchase') {
          g = applySale(game, { customer: c, productId: deal.productId!, price: a.newPrice, method, recordedWeightMg: deal.newWeighedMg! });
        } else if (c.intent === 'sellback') {
          g = applyBuyback(game, { customer: c, oldGold: c.oldGold!, assessedKarat: deal.oldAssessed!, recordedWeightMg: deal.oldWeighedMg!, price: a.oldPrice, method });
        } else {
          g = applyExchange(game, {
            customer: c, productId: deal.productId!, newPrice: a.newPrice, newRecordedWeightMg: deal.newWeighedMg!,
            oldGold: c.oldGold!, assessedKarat: deal.oldAssessed!, oldRecordedWeightMg: deal.oldWeighedMg!, oldPrice: a.oldPrice, method,
          });
        }
        set({ game: g, deal: { ...deal, invoice: g.transactions[g.transactions.length - 1] }, overlay: 'invoice' });
        sfx.cash();
      } catch (e) {
        get().toast((e as Error).message, 'bad');
        sfx.error();
      }
    },

    finishInvoice() {
      const { game, deal } = get();
      if (!game || !deal?.agreed) return;
      sfx.print();
      const c = deal.customer;
      const ratio = deal.agreedRatio;
      let rep = ratio <= 0 ? 2 : 1;
      if (c.personaId === 'khach-vip' && deal.patience > 40) rep += 2;
      if (PERSONAS[c.personaId].picky && ratio <= 0) rep += 1;
      customerLeaves(true, rep, say(rng, 'thanks'));
    },

    doRestock(templateId, qty) {
      const g = get().game;
      if (!g) return;
      const r = restock(g, templateId, qty);
      if (!r) return get().toast('Không đủ tiền hoặc chưa mở khóa sản phẩm.', 'bad');
      set({ game: r });
      persist(r);
      sfx.cash();
    },

    doRefine(ids) {
      const g = get().game;
      if (!g || !ids.length) return;
      const r = refineScrap(g, ids);
      set({ game: r.state });
      persist(r.state);
      const pl = r.proceeds - r.cost;
      get().toast(`Xưởng trả ${formatVnd(r.proceeds)} (${pl >= 0 ? 'lãi' : 'lỗ'} ${formatVnd(Math.abs(pl))})${r.fakeCount ? ` — ${r.fakeCount} món là vàng giả!` : ''}`, pl >= 0 ? 'good' : 'bad');
      sfx.cash();
    },

    doUpgrade(id) {
      const g = get().game;
      if (!g) return;
      const r = buyUpgrade(g, id);
      if (!r) return get().toast('Không đủ tiền hoặc chưa đủ cấp độ.', 'bad');
      set({ game: r });
      persist(r);
      sfx.success();
    },

    doMoveFunds(toBank) {
      const g = get().game;
      if (!g) return;
      const r = moveFunds(g, toBank);
      if (!r) return get().toast('Số dư không đủ.', 'bad');
      set({ game: r });
      persist(r);
      sfx.click();
    },

    nextDay() {
      const g = get().game;
      if (!g || g.phase !== 'report') return;
      const n = startNextDay(g);
      set({ game: n, overlay: 'dayStart', deal: null, dialog: null });
      persist(n);
    },
  };
});

