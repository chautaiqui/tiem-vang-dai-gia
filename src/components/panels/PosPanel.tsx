import { useEffect, useRef, useState } from 'react';
import { KARATS } from '../../game/logic/gold';
import { buyValue, refineValue, sellValue } from '../../game/logic/pricing';
import { snapQuote } from '../../game/logic/negotiation';
import { TEMPLATE_BY_ID } from '../../game/logic/products';
import { formatChi, formatGram, formatVnd } from '../../game/logic/units';
import { dealProduct, missingSteps, useGame } from '../../stores/gameStore';
import { Modal, PatienceStrip } from './Modal';

function PriceInput({ label, value, onChange, presets }: { label: string; value: number; onChange: (v: number) => void; presets: [string, number][] }) {
  return (
    <div className="price-input">
      <label>{label}</label>
      <div className="row">
        <button className="ghost" onClick={() => onChange(Math.max(0, value - 100_000))}>−100k</button>
        <input
          type="number"
          step={10_000}
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
          onBlur={() => onChange(snapQuote(value))}
        />
        <button className="ghost" onClick={() => onChange(value + 100_000)}>+100k</button>
      </div>
      <div className="row presets">
        {presets.map(([l, v]) => <button key={l} className="ghost small" onClick={() => onChange(snapQuote(v))}>{l}</button>)}
      </div>
      <div className="big-number">{formatVnd(value)}</div>
    </div>
  );
}

export function PosPanel() {
  const game = useGame((s) => s.game)!;
  const deal = useGame((s) => s.deal)!;
  const submit = useGame((s) => s.submitQuote);
  const acceptCounter = useGame((s) => s.acceptCounter);
  const refuseFake = useGame((s) => s.refuseFake);
  const dismiss = useGame((s) => s.dismissCustomer);
  const c = deal.customer;
  const product = dealProduct(game, deal);
  const missing = missingSteps(game, deal);
  const { prices } = game;

  const listFromScale = product && deal.newWeighedMg !== null ? sellValue(prices, product.karat, deal.newWeighedMg) + product.laborFee : 0;
  const oldBoard = c.oldGold && deal.oldWeighedMg !== null && deal.oldAssessed ? buyValue(prices, deal.oldAssessed, deal.oldWeighedMg) : 0;
  const oldRefine = c.oldGold && deal.oldWeighedMg !== null && deal.oldAssessed ? refineValue(prices, deal.oldAssessed, deal.oldWeighedMg) : 0;

  const [newPrice, setNewPrice] = useState(listFromScale);
  const [oldPrice, setOldPrice] = useState(oldBoard);
  useEffect(() => setNewPrice(listFromScale), [listFromScale]);
  useEffect(() => setOldPrice(oldBoard), [oldBoard]);

  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatRef.current?.scrollTo(0, 99999); }, [deal.chat.length]);

  const net = newPrice - oldPrice;
  const ready = missing.length === 0;

  return (
    <Modal title="Máy tính tiền — Báo giá & thương lượng" wide>
      <PatienceStrip />
      <div className="pos-layout">
        <div>
          {!ready && (
            <div className="callout bad">
              Chưa thể báo giá. Còn thiếu:
              <ul>{missing.map((m) => <li key={m}>{m}</li>)}</ul>
            </div>
          )}

          {c.intent !== 'sellback' && product && (
            <section className="calc">
              <h3>Sản phẩm bán ra</h3>
              <table><tbody>
                <tr><td>Sản phẩm</td><td>{product.name}{c.wantTemplateId && product.templateId !== c.wantTemplateId && <span className="bad"> (khách cần {TEMPLATE_BY_ID[c.wantTemplateId].name}!)</span>}</td></tr>
                <tr><td>Trọng lượng (theo cân)</td><td>{deal.newWeighedMg !== null ? `${formatGram(deal.newWeighedMg)} = ${formatChi(deal.newWeighedMg)}` : '—'}</td></tr>
                <tr><td>Đơn giá {KARATS[product.karat].short} bán ra</td><td>{formatVnd(prices.table[product.karat].sell)}/chỉ</td></tr>
                <tr><td>Tiền công</td><td>{formatVnd(product.laborFee)}</td></tr>
                <tr className="total"><td>Giá niêm yết</td><td>{formatVnd(listFromScale)}</td></tr>
                <tr className="muted"><td>Giá vốn</td><td>{formatVnd(product.cost)}</td></tr>
              </tbody></table>
            </section>
          )}

          {c.oldGold && deal.hasOld && (
            <section className="calc">
              <h3>Vàng cũ thu vào</h3>
              <table><tbody>
                <tr><td>Món</td><td>{c.oldGold.name}</td></tr>
                <tr><td>Trọng lượng (theo cân)</td><td>{deal.oldWeighedMg !== null ? `${formatGram(deal.oldWeighedMg)} = ${formatChi(deal.oldWeighedMg)}` : '—'}</td></tr>
                <tr><td>Tuổi vàng (bạn kiểm định)</td><td>{deal.oldAssessed ? KARATS[deal.oldAssessed].label : '—'}</td></tr>
                <tr><td>Đơn giá mua vào</td><td>{deal.oldAssessed && deal.oldAssessed !== 'FAKE' ? `${formatVnd(prices.table[deal.oldAssessed].buy)}/chỉ` : '—'}</td></tr>
                <tr className="total"><td>Giá trị theo bảng</td><td>{formatVnd(oldBoard)}</td></tr>
                <tr className="muted"><td>Xưởng nấu trả (dự kiến)</td><td>{formatVnd(oldRefine)}</td></tr>
              </tbody></table>
              {deal.oldAssessed === 'FAKE' && <button className="danger" onClick={refuseFake}>Từ chối thu mua — vàng không đạt</button>}
            </section>
          )}
        </div>

        <div>
          {ready && c.intent !== 'sellback' && (
            <PriceInput label="Giá bán món mới" value={newPrice} onChange={setNewPrice}
              presets={[['Niêm yết', listFromScale], ['−0,5%', listFromScale * 0.995], ['−1%', listFromScale * 0.99], ['Miễn công', listFromScale - (product?.laborFee ?? 0)], ['+1%', listFromScale * 1.01]]} />
          )}
          {ready && c.intent !== 'purchase' && (
            <PriceInput label="Giá thu mua vàng cũ" value={oldPrice} onChange={setOldPrice}
              presets={[['Theo bảng', oldBoard], ['−2%', oldBoard * 0.98], ['−5%', oldBoard * 0.95], ['+1%', oldBoard * 1.01]]} />
          )}
          {ready && c.intent === 'exchange' && (
            <div className="callout">{net >= 0 ? `Khách bù thêm: ${formatVnd(net)}` : `Tiệm trả lại khách: ${formatVnd(-net)}`}</div>
          )}
          {ready && c.intent === 'purchase' && product && (
            <div className="muted small">Lãi dự kiến: <b className={newPrice - product.cost >= 0 ? 'good' : 'bad'}>{formatVnd(newPrice - product.cost)}</b></div>
          )}
          {ready && c.intent === 'sellback' && (
            <div className="muted small">Lãi dự kiến khi bán xưởng: <b className={oldRefine - oldPrice >= 0 ? 'good' : 'bad'}>{formatVnd(oldRefine - oldPrice)}</b></div>
          )}

          <div className="chat" ref={chatRef}>
            {deal.chat.map((l, i) => <div key={i} className={`chat-line ${l.who}`}>{l.text}</div>)}
          </div>

          <div className="row actions">
            <button disabled={!ready} onClick={() => submit(newPrice, oldPrice)}>Báo giá</button>
            {deal.counter !== null && (
              <button className="secondary" onClick={acceptCounter}>
                Đồng ý giá khách: {formatVnd(deal.counter)}
              </button>
            )}
            <button className="ghost" onClick={dismiss}>Mời khách về</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
