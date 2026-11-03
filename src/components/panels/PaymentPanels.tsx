import { KARATS } from '../../game/logic/gold';
import { LEVEL_NAMES } from '../../game/logic/game';
import { formatChi, formatGram, formatVnd } from '../../game/logic/units';
import { quoteValue, useGame } from '../../stores/gameStore';
import { Modal } from './Modal';

function FakeQr({ seed }: { seed: number }) {
  const cells = Array.from({ length: 21 * 21 }, (_, i) => {
    const x = i % 21;
    const y = Math.floor(i / 21);
    const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
    if (finder) {
      const fx = x > 13 ? x - 14 : x;
      const fy = y > 13 ? y - 14 : y;
      return fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx > 1 && fx < 5 && fy > 1 && fy < 5);
    }
    return ((x * 31 + y * 17 + seed) * 2654435761) % 7 < 3;
  });
  return (
    <div className="qr">
      {cells.map((on, i) => <i key={i} className={on ? 'on' : ''} />)}
      <span>QR GIẢ LẬP</span>
    </div>
  );
}

export function PaymentPanel() {
  const game = useGame((s) => s.game)!;
  const deal = useGame((s) => s.deal)!;
  const confirm = useGame((s) => s.confirmPayment);
  const c = deal.customer;
  const amount = quoteValue(c.intent, deal.agreed!);

  if (amount > 0 && c.intent !== 'sellback') {
    const method = c.payMethod;
    return (
      <Modal title="Thanh toán" closable={false}>
        <p>{c.name} thanh toán <b className="gold big">{formatVnd(amount)}</b></p>
        {method === 'transfer' ? (
          <div className="pay-qr">
            <FakeQr seed={amount % 9973} />
            <p>Khách quét mã chuyển khoản <b>giả lập</b> vào tài khoản tiệm.</p>
          </div>
        ) : (
          <p>💵 Khách trả bằng <b>tiền mặt</b>. Đếm tiền và cất vào két.</p>
        )}
        <button onClick={() => confirm(method)}>Xác nhận đã nhận tiền</button>
      </Modal>
    );
  }

  const pay = Math.abs(amount);
  const prefer = c.payMethod === 'cash' ? 'tiền mặt' : 'chuyển khoản';
  return (
    <Modal title="Chi trả cho khách" closable={false}>
      <p>Tiệm trả cho {c.name}: <b className="gold big">{formatVnd(pay)}</b></p>
      <p className="muted">Khách muốn nhận bằng {prefer}.</p>
      <div className="row">
        <button disabled={game.shop.cash < pay} onClick={() => confirm('cash')}>💵 Tiền mặt (két: {formatVnd(game.shop.cash)})</button>
        <button disabled={game.shop.bank < pay} onClick={() => confirm('transfer')}>🏦 Chuyển khoản (TK: {formatVnd(game.shop.bank)})</button>
      </div>
      {game.shop.cash < pay && game.shop.bank < pay && <p className="bad">Không đủ tiền! Hãy rút/nộp tiền ở két sắt sau. Bấm “Mời khách về”.</p>}
      {game.shop.cash < pay && game.shop.bank < pay && <button className="ghost" onClick={() => useGame.getState().dismissCustomer()}>Mời khách về</button>}
    </Modal>
  );
}

export function InvoicePanel() {
  const game = useGame((s) => s.game)!;
  const deal = useGame((s) => s.deal)!;
  const finish = useGame((s) => s.finishInvoice);
  const tx = deal.invoice!;
  return (
    <Modal title="Hóa đơn" closable={false}>
      <div className="invoice">
        <div className="inv-head">
          <b>TIỆM VÀNG ĐẠI GIA</b>
          <span>{LEVEL_NAMES[game.shop.level]}</span>
          <span>Số HĐ: {tx.id} · Ngày game {tx.day}</span>
          <span>Khách hàng: {tx.customerName}</span>
        </div>
        <table>
          <thead><tr><th>Hàng</th><th>Tuổi</th><th>TL</th><th>Đơn giá/chỉ</th><th>Công</th><th>Thành tiền</th></tr></thead>
          <tbody>
            {tx.lines!.map((l, i) => (
              <tr key={i}>
                <td>{l.label}</td>
                <td>{KARATS[l.karat].short}</td>
                <td>{formatGram(l.weightMg)}<br /><small>{formatChi(l.weightMg)}</small></td>
                <td>{formatVnd(l.pricePerChi)}</td>
                <td>{l.laborFee ? formatVnd(l.laborFee) : '—'}</td>
                <td>{l.direction < 0 ? '−' : ''}{formatVnd(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="inv-total">
          {tx.amount >= 0 ? 'Khách thanh toán' : 'Tiệm chi trả'}: <b>{formatVnd(Math.abs(tx.amount))}</b>
          <span>Hình thức: {tx.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản (giả lập)'}</span>
        </div>
        <div className="inv-foot">Tiền ảo · Giá giả lập · Mô phỏng giải trí</div>
      </div>
      <button onClick={finish}>🖨 In hóa đơn & giao khách</button>
    </Modal>
  );
}
