import { useState } from 'react';
import { LEVEL_NAMES, restockQuote, unlockedTemplates, UPGRADES } from '../../game/logic/game';
import { KARATS } from '../../game/logic/gold';
import { refineValue, sellValue } from '../../game/logic/pricing';
import { formatChi, formatGram, formatVnd } from '../../game/logic/units';
import { useGame } from '../../stores/gameStore';
import { Modal } from './Modal';

type Tab = 'report' | 'scrap' | 'restock' | 'upgrade' | 'ledger';

const signed = (n: number) => <b className={n >= 0 ? 'good' : 'bad'}>{n >= 0 ? '+' : '−'}{formatVnd(Math.abs(n))}</b>;

function Summary() {
  const game = useGame((s) => s.game)!;
  const r = game.reports.at(-1);
  if (!r) return null;
  const salesProfit = r.revenue - r.cogs;
  return (
    <>
      {r.leveledUp && <div className="callout good">🎉 Lên cấp! Tiệm của bạn giờ là <b>{LEVEL_NAMES[game.shop.level]}</b>. Đã mở khóa trang sức 18K/14K, tủ kính cao cấp và máy XRF.</div>}
      <table className="report-table"><tbody>
        <tr><td>Doanh thu bán hàng</td><td>{formatVnd(r.revenue)}</td></tr>
        <tr><td>Giá vốn hàng bán</td><td>−{formatVnd(r.cogs)}</td></tr>
        <tr className="total"><td>Lãi gộp bán hàng</td><td>{signed(salesProfit)}</td></tr>
        <tr><td>Chi thu mua vàng cũ</td><td>{formatVnd(r.buybackSpend)}</td></tr>
        <tr><td>Bán cho xưởng nấu (thu / giá vốn)</td><td>{formatVnd(r.refineProceeds)} / {formatVnd(r.refineCost)}</td></tr>
        <tr><td>Chi phí vận hành</td><td>−{formatVnd(r.expenses)}</td></tr>
        <tr className="total"><td>Lãi/lỗ ròng (gộp + xưởng − chi phí)</td><td>{signed(r.grossProfit - r.expenses)}</td></tr>
        <tr><td>Khách phục vụ / bỏ đi</td><td>{r.customersServed} / {r.customersLost}</td></tr>
        <tr><td>Uy tín</td><td>{r.reputationStart} → <b>{r.reputationEnd}</b></td></tr>
        <tr><td>Tiền mặt · Ngân hàng</td><td>{formatVnd(game.shop.cash)} · {formatVnd(game.shop.bank)}</td></tr>
        <tr><td>Tồn kho (định giá mua vào)</td><td>{formatVnd(r.inventoryValue)}</td></tr>
        <tr className="total"><td>Tổng tài sản</td><td>{formatVnd(r.netWorthEnd)} ({signed(r.netWorthEnd - r.netWorthStart)})</td></tr>
      </tbody></table>
      <p className="muted small">Tổng tài sản dao động theo giá vàng vì tồn kho được định giá theo giá mua vào của ngày.</p>
    </>
  );
}

function Scrap() {
  const game = useGame((s) => s.game)!;
  const refine = useGame((s) => s.doRefine);
  const [sel, setSel] = useState<string[]>(game.scrap.map((x) => x.id));
  if (!game.scrap.length) return <p className="muted">Không có vàng cũ chờ xử lý.</p>;
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <>
      <p className="muted">Xưởng nấu trả theo <b>tuổi vàng thật</b> (giá giữa trừ phí xử lý). Nếu bạn kiểm định sai, đây là lúc sự thật lộ ra.</p>
      <table className="list-table">
        <thead><tr><th></th><th>Món</th><th>Bạn đánh giá</th><th>TL</th><th>Giá thu</th><th>Xưởng trả (dự kiến theo đánh giá)</th></tr></thead>
        <tbody>
          {game.scrap.map((x) => (
            <tr key={x.id}>
              <td><input type="checkbox" checked={sel.includes(x.id)} onChange={() => toggle(x.id)} /></td>
              <td>{x.name}</td>
              <td>{KARATS[x.assessedKarat].short}</td>
              <td>{formatGram(x.recordedWeightMg)}</td>
              <td>{formatVnd(x.cost)}</td>
              <td>{formatVnd(refineValue(game.prices, x.assessedKarat, x.recordedWeightMg))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button disabled={!sel.length} onClick={() => { refine(sel); setSel([]); }}>Bán {sel.length} món cho xưởng nấu</button>
      <p className="muted small">Có thể giữ lại vàng cũ để chờ giá lên.</p>
    </>
  );
}

function Restock() {
  const game = useGame((s) => s.game)!;
  const restock = useGame((s) => s.doRestock);
  return (
    <>
      <p className="muted">Nhập hàng từ xưởng sỉ (giá kim loại + tiền công gia công). Thanh toán từ ngân hàng trước, rồi tiền mặt. Có: <b>{formatVnd(game.shop.bank)}</b> NH · <b>{formatVnd(game.shop.cash)}</b> TM</p>
      <table className="list-table">
        <thead><tr><th>Sản phẩm</th><th>TL chuẩn</th><th>Tồn</th><th>Giá nhập ~</th><th>Giá bán ~</th><th></th></tr></thead>
        <tbody>
          {unlockedTemplates(game).map((t) => {
            const cost = restockQuote(game.prices, t.id);
            const sell = sellValue(game.prices, t.karat, t.baseWeightMg) + t.laborFee;
            const stock = game.products.filter((p) => p.templateId === t.id).length;
            return (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{formatChi(t.baseWeightMg)}</td>
                <td>{stock}</td>
                <td>{formatVnd(cost)}</td>
                <td>{formatVnd(sell)} <small className="good">(+{formatVnd(sell - cost)})</small></td>
                <td className="row">
                  <button className="small" onClick={() => restock(t.id, 1)}>+1</button>
                  <button className="small secondary" onClick={() => restock(t.id, 3)}>+3</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {game.shop.level < 2 && <p className="muted small">Dây chuyền, lắc tay 18K và trang sức 14K mở khóa ở cấp 2.</p>}
    </>
  );
}

function Upgrades() {
  const game = useGame((s) => s.game)!;
  const buy = useGame((s) => s.doUpgrade);
  return (
    <div className="upgrade-grid">
      {UPGRADES.map((u) => {
        const owned = game.upgrades[u.id];
        const locked = u.minLevel > game.shop.level;
        return (
          <div key={u.id} className={`upgrade ${owned ? 'owned' : ''}`}>
            <b>{u.name}</b>
            <span>{u.description}</span>
            <span className="gold">{formatVnd(u.price)}</span>
            {owned ? <span className="good">✔ Đã sở hữu</span> : locked ? <span className="muted">Cần cấp {u.minLevel}</span> : <button onClick={() => buy(u.id)}>Mua</button>}
          </div>
        );
      })}
    </div>
  );
}

function Ledger() {
  const game = useGame((s) => s.game)!;
  const txs = game.transactions.filter((t) => t.day === game.day).reverse();
  return (
    <table className="list-table">
      <thead><tr><th>Mã</th><th>Nội dung</th><th>Khách</th><th>Tài khoản</th><th>Số tiền</th></tr></thead>
      <tbody>
        {txs.map((t) => (
          <tr key={t.id}><td>{t.id}</td><td>{t.description}</td><td>{t.customerName ?? ''}</td><td>{t.account === 'cash' ? 'Tiền mặt' : 'Ngân hàng'}</td><td>{signed(t.amount)}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

const TABS: [Tab, string][] = [['report', 'Báo cáo'], ['scrap', 'Vàng cũ → xưởng'], ['restock', 'Nhập hàng'], ['upgrade', 'Nâng cấp'], ['ledger', 'Sổ giao dịch']];

export function ReportPanel() {
  const game = useGame((s) => s.game)!;
  const next = useGame((s) => s.nextDay);
  const quit = useGame((s) => s.quitToTitle);
  const [tab, setTab] = useState<Tab>('report');
  return (
    <Modal
      title={`🌙 Tổng kết ngày ${game.day}`}
      wide
      closable={false}
      footer={<><button className="ghost" onClick={quit}>Lưu & về màn hình chính</button><button onClick={next}>Sang ngày {game.day + 1} ▶</button></>}
    >
      <div className="tabs">
        {TABS.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}{id === 'scrap' && game.scrap.length ? ` (${game.scrap.length})` : ''}</button>)}
      </div>
      {tab === 'report' && <Summary />}
      {tab === 'scrap' && <Scrap />}
      {tab === 'restock' && <Restock />}
      {tab === 'upgrade' && <Upgrades />}
      {tab === 'ledger' && <Ledger />}
    </Modal>
  );
}
