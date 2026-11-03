import { useMemo, useState } from 'react';
import { ALL_KARATS, KARATS, type Karat } from '../../game/logic/gold';
import { ACID_GUIDE, ACID_RESULT_TEXT, ACIDS, acidTest, xrfReading, type Acid, type AcidResult } from '../../game/logic/inspection';
import { mulberry32 } from '../../game/logic/rng';
import { sfx } from '../../services/audio';
import { useGame } from '../../stores/gameStore';
import { Modal, PatienceStrip } from './Modal';

interface TestRow { acid: Acid; result: AcidResult }

export function InspectionPanel() {
  const game = useGame((s) => s.game)!;
  const deal = useGame((s) => s.deal)!;
  const assess = useGame((s) => s.assess);
  const losePatience = useGame((s) => s.losePatience);
  const close = useGame((s) => s.closeOverlay);
  const old = deal.customer.oldGold!;
  const rng = useMemo(() => mulberry32((Date.now() ^ 0x27d4eb2d) >>> 0), []);
  const [streak, setStreak] = useState(false);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [xrf, setXrf] = useState<number | null>(null);
  const [guide, setGuide] = useState(true);
  const info = KARATS[old.trueKarat];

  const rub = () => { setStreak(true); sfx.click(); losePatience(1); };
  const drop = (acid: Acid) => {
    const result = acidTest(old.trueKarat, acid, rng);
    setTests((t) => [...t, { acid, result }]);
    losePatience(3);
    sfx.fizz();
  };
  const scan = () => { setXrf(xrfReading(old.trueKarat, rng)); losePatience(2); sfx.beep(); };
  const conclude = (k: Karat) => { assess(k); sfx.click(); close(); };

  return (
    <Modal title="Bộ kiểm định tuổi vàng" wide>
      <PatienceStrip />
      <div className="inspect-layout">
        <div>
          <p><b>{old.name}</b> — khách nói: <b>{old.claimedKarat === 'FAKE' ? 'không rõ' : KARATS[old.claimedKarat].label}</b></p>
          <h3>1. Chà lên đá thử</h3>
          <div className="touchstone">
            {streak && <div className="streak" style={{ background: info.streak }} />}
            {tests.map((t, i) => (
              <div key={i} className={`acid-drop ${t.result}`} style={{ left: `${20 + i * 14}%`, borderColor: ACIDS[t.acid].color }} />
            ))}
          </div>
          {!streak ? <button onClick={rub}>Chà món vàng lên đá</button> : <p className="muted">{info.streakText}</p>}
          <h3>2. Nhỏ nước thử</h3>
          <div className="row">
            {(Object.keys(ACIDS) as Acid[]).map((a) => (
              <button key={a} disabled={!streak} className="acid-btn" style={{ borderColor: ACIDS[a].color }} onClick={() => drop(a)}>{ACIDS[a].label}</button>
            ))}
          </div>
          <ul className="test-log">
            {tests.map((t, i) => (
              <li key={i}><b style={{ color: ACIDS[t.acid].color }}>{ACIDS[t.acid].label}:</b> {ACID_RESULT_TEXT[t.result]}</li>
            ))}
          </ul>
          {game.upgrades.xrf && (
            <>
              <h3>Máy XRF</h3>
              <button onClick={scan}>Quét quang phổ</button>
              {xrf !== null && <p className="xrf">Au: <b>{xrf.toLocaleString('vi-VN')}%</b></p>}
            </>
          )}
        </div>
        <div>
          <button className="ghost small" onClick={() => setGuide(!guide)}>{guide ? 'Ẩn' : 'Hiện'} bảng tra</button>
          {guide && <ul className="guide">{ACID_GUIDE.map((g) => <li key={g}>{g}</li>)}</ul>}
          <p className="muted small">Mỗi lần thử làm khách chờ thêm. Bộ thử cơ bản đôi khi cho phản ứng không rõ — hãy thử lại.</p>
          <h3>3. Kết luận</h3>
          <div className="karat-choices">
            {ALL_KARATS.map((k) => (
              <button key={k} className={deal.oldAssessed === k ? 'selected' : 'secondary'} onClick={() => conclude(k)}>{KARATS[k].label}</button>
            ))}
          </div>
          <p className="muted small">Kết luận sai sẽ khiến bạn trả giá sai — xưởng nấu chỉ trả tiền theo tuổi vàng thật.</p>
        </div>
      </div>
    </Modal>
  );
}
