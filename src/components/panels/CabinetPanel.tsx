import { listPrice } from '../../game/logic/game';
import { KARATS } from '../../game/logic/gold';
import { TEMPLATE_BY_ID } from '../../game/logic/products';
import { formatChi, formatGram, formatVnd } from '../../game/logic/units';
import { useGame } from '../../stores/gameStore';
import { Modal, PatienceStrip } from './Modal';

export function CabinetPanel() {
  const game = useGame((s) => s.game)!;
  const deal = useGame((s) => s.deal);
  const pick = useGame((s) => s.pickProduct);
  const giveBack = useGame((s) => s.returnProduct);
  const close = useGame((s) => s.closeOverlay);
  const canPick = !!deal && deal.stage === 'serving' && deal.customer.intent !== 'sellback';
  const want = deal?.customer.wantTemplateId;
  const products = [...game.products].sort((a, b) =>
    (b.templateId === want ? 1 : 0) - (a.templateId === want ? 1 : 0) || a.templateId.localeCompare(b.templateId) || a.weightMg - b.weightMg,
  );

  return (
    <Modal title="Tủ trưng bày" wide>
      {deal && <PatienceStrip />}
      {canPick && want && <p className="callout">Khách cần: <b>{TEMPLATE_BY_ID[want].name}</b></p>}
      {!canPick && <p className="muted">Đang xem hàng. Hãy tiếp chuyện khách mua để lấy sản phẩm.</p>}
      {products.length === 0 && <p className="callout bad">Tủ trống! Hãy nhập hàng ở báo cáo cuối ngày.</p>}
      <div className="product-grid">
        {products.map((p) => {
          const held = deal?.productId === p.id;
          return (
            <div key={p.id} className={`product-card ${p.templateId === want ? 'wanted' : ''} ${held ? 'held' : ''}`}>
              <div className="pc-name">{p.name}</div>
              <div className="pc-meta">{KARATS[p.karat].short} · Nhãn: {formatGram(p.weightMg)} ({formatChi(p.weightMg)})</div>
              <div className="pc-meta">Niêm yết: <b className="gold">{formatVnd(listPrice(game.prices, p))}</b></div>
              <div className="pc-meta muted">Giá vốn {formatVnd(p.cost)} · Công {formatVnd(p.laborFee)}</div>
              {canPick && (held
                ? <button className="secondary" onClick={giveBack}>Trả lại tủ</button>
                : <button onClick={() => { pick(p.id); close(); }}>Lấy món này</button>)}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
