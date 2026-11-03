import { useState } from 'react';
import { PERSONAS } from '../../game/logic/customers';
import { inventoryValue, LEVEL2_REQUIREMENT, netWorth } from '../../game/logic/game';
import { KARATS, TRADED_KARATS } from '../../game/logic/gold';
import { formatGram, formatMillions, formatVnd } from '../../game/logic/units';
import { useGame } from '../../stores/gameStore';
import { Modal } from './Modal';

function Sparkline({ points }: { points: { day: number; spot: number }[] }) {
  if (points.length < 2) return <p className="muted small">Chưa đủ dữ liệu lịch sử giá.</p>;
  const w = 320;
  const h = 70;
  const min = Math.min(...points.map((p) => p.spot));
  const max = Math.max(...points.map((p) => p.spot));
  const span = Math.max(1, max - min);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${(i / (points.length - 1)) * w},${h - ((p.spot - min) / span) * (h - 10) - 5}`).join(' ');
  return (
    <svg width={w} height={h} className="spark" role="img" aria-label="Lịch sử giá 9999">
      <path d={d} fill="none" stroke="#f2b632" strokeWidth={2} />
    </svg>
  );
}

export function PriceTable() {
  const prices = useGame((s) => s.game!.prices);
  return (
    <table className="price-table">
      <thead><tr><th>Loại</th><th>Mua vào</th><th>Bán ra</th></tr></thead>
      <tbody>
        {TRADED_KARATS.map((k) => (
          <tr key={k}><td>{KARATS[k].label}</td><td className="good">{formatVnd(prices.table[k].buy)}</td><td className="bad">{formatVnd(prices.table[k].sell)}</td></tr>
        ))}
      </tbody>
      <tfoot><tr><td colSpan={3} className="muted small">Đơn vị: đồng/chỉ (3,75 g) · giá giả lập</td></tr></tfoot>
    </table>
  );
}

export function BoardPanel() {
  const game = useGame((s) => s.game)!;
  return (
    <Modal title={`Bảng giá vàng — Ngày ${game.day}`}>
      <PriceTable />
      {game.prices.event && <div className="callout">📰 <b>{game.prices.event.title}</b> — {game.prices.event.description}</div>}
      <h3>Giá 9999 tham chiếu {game.priceHistory.length} ngày gần nhất</h3>
      <Sparkline points={game.priceHistory} />
      <p className="muted small">1 lượng (cây) = 10 chỉ = 37,5 g · 1 chỉ = 10 phân = 3,75 g</p>
    </Modal>
  );
}

export function SafePanel() {
  const game = useGame((s) => s.game)!;
  const move = useGame((s) => s.doMoveFunds);
  const [amount, setAmount] = useState(20_000_000);
  const { shop } = game;
  return (
    <Modal title="Két sắt & sổ sách" wide>
      <div className="stats-grid">
        <div><span>Tiền mặt</span><b>{formatVnd(shop.cash)}</b></div>
        <div><span>Ngân hàng</span><b>{formatVnd(shop.bank)}</b></div>
        <div><span>Giá trị tồn kho (giá mua vào)</span><b>{formatVnd(inventoryValue(game))}</b></div>
        <div><span>Tổng tài sản</span><b className="gold">{formatVnd(netWorth(game))}</b></div>
      </div>
      <h3>Nộp / rút tiền</h3>
      <div className="row">
        <input type="number" step={1_000_000} value={amount} onChange={(e) => setAmount(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
        <button onClick={() => move(amount)}>Nộp vào ngân hàng</button>
        <button className="secondary" onClick={() => move(-amount)}>Rút ra tiền mặt</button>
      </div>
      <p className="muted small">Khách trả tiền mặt sẽ vào két; chuyển khoản vào ngân hàng. Nhập hàng & nâng cấp trừ ngân hàng trước.</p>
      <h3>Tồn kho ({game.products.length} món)</h3>
      <table className="list-table">
        <thead><tr><th>Mã</th><th>Sản phẩm</th><th>TL</th><th>Giá vốn</th></tr></thead>
        <tbody>{game.products.map((p) => <tr key={p.id}><td>{p.id}</td><td>{p.name}</td><td>{formatGram(p.weightMg)}</td><td>{formatVnd(p.cost)}</td></tr>)}</tbody>
      </table>
      <h3>Vàng cũ chờ xử lý ({game.scrap.length} món)</h3>
      <table className="list-table">
        <thead><tr><th>Mã</th><th>Món</th><th>Đánh giá</th><th>TL ghi</th><th>Giá thu</th></tr></thead>
        <tbody>{game.scrap.map((x) => <tr key={x.id}><td>{x.id}</td><td>{x.name}</td><td>{KARATS[x.assessedKarat].short}</td><td>{formatGram(x.recordedWeightMg)}</td><td>{formatVnd(x.cost)}</td></tr>)}</tbody>
      </table>
    </Modal>
  );
}

export function DayStartPanel() {
  const game = useGame((s) => s.game)!;
  const close = useGame((s) => s.closeOverlay);
  const prev = game.priceHistory.at(-2)?.spot;
  const change = prev ? (game.prices.spot - prev) / prev : 0;
  const lvl = game.shop.level === 1;
  return (
    <Modal title={`☀️ Ngày ${game.day} — Chào buổi sáng!`} closable={false} footer={<button onClick={close}>Vào tiệm</button>}>
      <PriceTable />
      {prev && <p>Giá 9999 so với hôm qua: <b className={change >= 0 ? 'good' : 'bad'}>{change >= 0 ? '▲' : '▼'} {(Math.abs(change) * 100).toFixed(2)}%</b></p>}
      {game.prices.event
        ? <div className="callout">📰 <b>{game.prices.event.title}</b> — {game.prices.event.description}</div>
        : <p className="muted">Thị trường hôm nay bình ổn.</p>}
      <p>Dự kiến <b>{game.customers.length}</b> lượt khách. Tồn kho: <b>{game.products.length}</b> món · Tiền: {formatMillions(game.shop.cash + game.shop.bank)}.</p>
      {lvl && <p className="muted small">Mục tiêu lên cấp 2 (Tiệm vàng phố lớn): uy tín ≥ {LEVEL2_REQUIREMENT.reputation} và tổng tài sản ≥ {formatMillions(LEVEL2_REQUIREMENT.netWorth)}.</p>}
      <p className="muted small">Bước tiếp: vào tiệm, nhìn vào cửa ra vào và bấm <kbd>E</kbd> để mở cửa đón khách.</p>
    </Modal>
  );
}

export function HelpPanel() {
  return (
    <Modal title="Hướng dẫn chơi" wide>
      <div className="help-grid">
        <div>
          <h3>Điều khiển</h3>
          <ul>
            <li><kbd>W A S D</kbd> di chuyển, chuột để nhìn</li>
            <li><kbd>E</kbd> tương tác với vật thể ở tâm màn hình</li>
            <li><kbd>1</kbd> <kbd>2</kbd> chọn câu trả lời hội thoại</li>
            <li><kbd>Esc</kbd> đóng bảng / nhả chuột · <kbd>H</kbd> hướng dẫn</li>
          </ul>
          <h3>Bán vàng cho khách</h3>
          <ol>
            <li>Tiếp chuyện khách (E)</li>
            <li>Lấy đúng món ở <b>tủ trưng bày</b> phía sau</li>
            <li><b>Cân</b>: TARE khay trống → đặt vàng → chờ STABLE → ghi số</li>
            <li><b>Máy tính tiền</b>: báo giá, thương lượng, thu tiền, in hóa đơn</li>
          </ol>
          <h3>Thu mua / đổi vàng cũ</h3>
          <ol>
            <li>Nhận món vàng từ khách</li>
            <li>Cân → <b>kiểm định</b> bằng đá thử + nước thử</li>
            <li>Báo giá thu mua (đổi: chọn thêm món mới)</li>
            <li>Cuối ngày bán vàng cũ cho <b>xưởng nấu</b></li>
          </ol>
        </div>
        <div>
          <h3>Khách hàng</h3>
          <ul>{Object.values(PERSONAS).map((p) => <li key={p.id}><b>{p.title}</b>{p.picky ? ' — soi cân rất kỹ' : ''}{p.id === 'khach-vip' ? ' — đơn lớn, cần phục vụ nhanh' : ''}{p.id === 'co-lon-tuoi' ? ' — thích mặc cả' : ''}{p.id === 'khach-tich-tru' ? ' — chỉ chấp nhận giá sát bảng' : ''}</li>)}</ul>
          <h3>Mẹo kinh doanh</h3>
          <ul>
            <li>Báo giá công bằng → uy tín tăng → nhiều khách hơn.</li>
            <li>Ép giá quá mức khiến khách bỏ đi, mất uy tín.</li>
            <li>Cân sai có lợi cho tiệm sẽ bị khách phát hiện.</li>
            <li>Kiểm định sai = mua hớ. Cẩn thận vàng giả!</li>
            <li>Giữ đủ tiền mặt trong két để thu mua vàng.</li>
          </ul>
          <p className="muted small">Mọi giá vàng, tiền, chuyển khoản trong game đều là dữ liệu giả lập phục vụ giải trí.</p>
        </div>
      </div>
    </Modal>
  );
}

export function BankruptPanel() {
  const startNew = useGame((s) => s.startNew);
  const quit = useGame((s) => s.quitToTitle);
  const game = useGame((s) => s.game)!;
  return (
    <Modal title="💸 Phá sản!" closable={false} footer={<><button onClick={startNew}>Chơi lại từ đầu</button><button className="ghost" onClick={quit}>Về màn hình chính</button></>}>
      <p>Tiệm đã cạn vốn sau {game.day} ngày kinh doanh. Tổng tài sản: {formatVnd(netWorth(game))}.</p>
      <p className="muted">Lần sau hãy cân bằng giữa nhập hàng, thu mua và giữ tiền mặt nhé.</p>
    </Modal>
  );
}
