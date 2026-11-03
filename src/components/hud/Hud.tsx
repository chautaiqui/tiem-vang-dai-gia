import { useEffect } from 'react';
import { PERSONAS } from '../../game/logic/customers';
import { LEVEL_NAMES } from '../../game/logic/game';
import { TEMPLATE_BY_ID } from '../../game/logic/products';
import { formatMillions, formatVnd } from '../../game/logic/units';
import { objective, TARGET_LABEL, useGame } from '../../stores/gameStore';

function clock(index: number, count: number): string {
  const minutes = 8 * 60 + Math.round((Math.min(index, count) / Math.max(1, count)) * 10 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function TopBar() {
  const game = useGame((s) => s.game)!;
  const { shop, prices } = game;
  return (
    <div className="topbar">
      <div className="tb-group">
        <b>Ngày {game.day}</b>
        <span>{game.phase === 'morning' ? 'Chưa mở cửa' : clock(game.customerIndex, game.customers.length)}</span>
        <span className="muted">{LEVEL_NAMES[shop.level]} · Cấp {shop.level}</span>
      </div>
      <div className="tb-group">
        <span title="Giá 9999 bán ra / chỉ">9999: <b className="gold">{formatVnd(prices.table.K24.sell)}</b>/chỉ</span>
        {prices.event && <span className="event-chip">📰 {prices.event.title}</span>}
      </div>
      <div className="tb-group">
        <span title="Tiền mặt trong két">💵 {formatMillions(shop.cash)}</span>
        <span title="Tài khoản ngân hàng">🏦 {formatMillions(shop.bank)}</span>
        <span title="Uy tín">⭐ {shop.reputation}</span>
        <span className="muted small">tiền ảo</span>
      </div>
    </div>
  );
}

function CustomerCard() {
  const deal = useGame((s) => s.deal);
  if (!deal || deal.stage === 'entering') return null;
  const c = deal.customer;
  const persona = PERSONAS[c.personaId];
  const want =
    c.intent === 'purchase' ? `Muốn mua: ${TEMPLATE_BY_ID[c.wantTemplateId!].name}`
      : c.intent === 'sellback' ? `Muốn bán: ${c.oldGold!.name}`
        : `Đổi ${c.oldGold!.name.toLowerCase()} → ${TEMPLATE_BY_ID[c.wantTemplateId!].name}`;
  const p = Math.max(0, deal.patience);
  return (
    <div className="customer-card">
      <div className="cc-name">{c.name} <span className="muted">· {persona.title}</span></div>
      {deal.stage !== 'waiting' && <div className="cc-want">{want}</div>}
      <div className="bar"><i style={{ width: `${p}%`, background: p > 60 ? '#3ecf6e' : p > 30 ? '#f2b632' : '#e5484d' }} /></div>
      <div className="muted small">Kiên nhẫn</div>
    </div>
  );
}

function Crosshair() {
  const focus = useGame((s) => s.focus);
  const overlay = useGame((s) => s.overlay);
  if (overlay) return null;
  return (
    <>
      <div className={`crosshair ${focus ? 'on' : ''}`} />
      {focus && <div className="focus-label"><kbd>E</kbd> {TARGET_LABEL[focus]}</div>}
    </>
  );
}

function DialogBox() {
  const dialog = useGame((s) => s.dialog);
  const close = useGame((s) => s.closeDialog);
  useEffect(() => {
    if (!dialog) return;
    if (!dialog.choices) {
      const t = setTimeout(close, 4000);
      return () => clearTimeout(t);
    }
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (dialog.choices && i >= 0 && i < dialog.choices.length) dialog.choices[i].run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, close]);
  if (!dialog) return null;
  return (
    <div className="dialog">
      <div className="dialog-speaker">{dialog.speaker}</div>
      <div className="dialog-text">“{dialog.text}”</div>
      {dialog.choices && (
        <div className="dialog-choices">
          {dialog.choices.map((c, i) => (
            <button key={c.label} onClick={c.run}><kbd>{i + 1}</kbd> {c.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.text}</div>)}
    </div>
  );
}

function Objective() {
  const text = useGame((s) => objective(s));
  if (!text) return null;
  return <div className="objective">🎯 {text}</div>;
}

function ClickToPlay() {
  const locked = useGame((s) => s.pointerLocked);
  const overlay = useGame((s) => s.overlay);
  const choices = useGame((s) => !!s.dialog?.choices);
  if (locked || overlay || choices) return null;
  return (
    <div className="click-to-play">
      <b>Nhấp chuột để điều khiển</b>
      <span>WASD di chuyển · Chuột nhìn · E tương tác · H hướng dẫn · Esc nhả chuột</span>
      <span className="muted small">(Khách tạm dừng chờ khi bạn nhả chuột)</span>
    </div>
  );
}

export function Hud() {
  return (
    <div className="hud">
      <TopBar />
      <CustomerCard />
      <Crosshair />
      <Objective />
      <DialogBox />
      <Toasts />
      <ClickToPlay />
    </div>
  );
}
