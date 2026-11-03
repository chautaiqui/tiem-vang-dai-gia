import { useEffect, useMemo, useRef, useState } from 'react';
import { TEMPLATE_BY_ID } from '../../game/logic/products';
import { mulberry32 } from '../../game/logic/rng';
import { formatChi, formatGram, MG_PER_CHI } from '../../game/logic/units';
import { initialScale, placeItem, readScale, removeItem, SCALE_BASIC, SCALE_PRO, tare, type Reading } from '../../game/logic/weighing';
import { sfx } from '../../services/audio';
import { dealProduct, useGame } from '../../stores/gameStore';
import { Modal, PatienceStrip } from './Modal';

type Which = 'new' | 'old';

export function ScalePanel() {
  const game = useGame((s) => s.game)!;
  const deal = useGame((s) => s.deal)!;
  const record = useGame((s) => s.recordWeight);
  const toast = useGame((s) => s.toast);
  const spec = game.upgrades.scalePro ? SCALE_PRO : SCALE_BASIC;
  const rng = useMemo(() => mulberry32((Date.now() ^ 0x5bd1e995) >>> 0), []);
  const [scale, setScale] = useState(() => initialScale(performance.now() - 10_000));
  const [onPan, setOnPan] = useState<Which | null>(null);
  const [reading, setReading] = useState<Reading>({ mg: spec.trayMg, stable: true });
  const wasStable = useRef(true);

  const product = dealProduct(game, deal);
  const old = deal.hasOld ? deal.customer.oldGold : undefined;
  const items: { which: Which; name: string; actualMg: number; recorded: number | null }[] = [];
  if (product) items.push({ which: 'new', name: product.name, actualMg: product.weightMg, recorded: deal.newWeighedMg });
  if (old) items.push({ which: 'old', name: `${old.name} (của khách)`, actualMg: old.weightMg, recorded: deal.oldWeighedMg });

  useEffect(() => {
    const id = setInterval(() => {
      const r = readScale(scale, spec, performance.now(), rng);
      if (r.stable && !wasStable.current) sfx.stable();
      wasStable.current = r.stable;
      setReading(r);
    }, 90);
    return () => clearInterval(id);
  }, [scale, spec, rng]);

  const put = (which: Which) => {
    const item = items.find((i) => i.which === which)!;
    let s = onPan ? removeItem(scale, performance.now()) : scale;
    s = placeItem(s, item.actualMg, spec, rng, performance.now());
    wasStable.current = false;
    setScale(s);
    setOnPan(which);
    sfx.beep();
  };
  const takeOff = () => {
    setScale(removeItem(scale, performance.now()));
    wasStable.current = false;
    setOnPan(null);
  };
  const doTare = () => {
    setScale(tare(scale, spec, performance.now()));
    wasStable.current = false;
    sfx.beep();
  };
  const doRecord = () => {
    if (!onPan) return;
    if (!reading.stable) toast('Số cân chưa ổn định — bạn đã ghi một số có thể sai!', 'bad');
    record(onPan, reading.mg);
    sfx.click();
  };

  return (
    <Modal title={`Bàn cân — ${spec.name}`} wide>
      <PatienceStrip />
      <div className="scale-layout">
        <div className="scale-items">
          <h3>Món vàng trên quầy</h3>
          {items.map((i) => (
            <div key={i.which} className={`scale-item ${onPan === i.which ? 'active' : ''}`}>
              <div>{i.name}</div>
              {i.recorded !== null ? <div className="good small">✔ Đã ghi: {formatGram(i.recorded)}</div> : <div className="muted small">Chưa cân</div>}
              {onPan === i.which
                ? <button className="secondary" onClick={takeOff}>Lấy xuống</button>
                : <button onClick={() => put(i.which)}>Đặt lên cân</button>}
            </div>
          ))}
          <div className="tip">
            <b>Mẹo:</b> Trên cân có sẵn khay đựng ({formatGram(spec.trayMg)}). Bấm <b>TARE</b> khi khay còn trống để trừ bì, rồi mới đặt vàng.
            Chờ đèn <b>STABLE</b> sáng rồi mới ghi số. Khách khó tính sẽ cân lại!
          </div>
        </div>
        <div className="scale-device">
          <div className={`lcd ${reading.stable ? 'stable' : ''}`}>
            <div className="lcd-main">{(reading.mg / 1000).toFixed(2)}<small> g</small></div>
            <div className="lcd-sub">{(reading.mg / MG_PER_CHI).toFixed(3)} chỉ</div>
            <div className="lcd-flags"><span className={reading.stable ? 'on' : ''}>● STABLE</span><span className={scale.tareMg ? 'on' : ''}>NET</span></div>
          </div>
          <div className="pan">
            <div className="tray" />
            {onPan && <div className="pan-item">{onPan === 'new' ? '💍' : '📿'}</div>}
          </div>
          <div className="scale-buttons">
            <button className="secondary" onClick={doTare}>TARE (Trừ bì)</button>
            <button disabled={!onPan} onClick={doRecord}>Ghi số vào phiếu</button>
          </div>
          {onPan && <div className="muted small">Đang cân: {items.find((i) => i.which === onPan)?.name} · số hiện tại {formatGram(reading.mg)} = {formatChi(reading.mg)}</div>}
          {product && <div className="muted small">Nhãn sản phẩm: {TEMPLATE_BY_ID[product.templateId].name} — {formatGram(product.weightMg)}</div>}
        </div>
      </div>
    </Modal>
  );
}
