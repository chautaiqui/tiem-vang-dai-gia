import { netWorth } from '../game/logic/game';
import { formatMillions } from '../game/logic/units';
import { useGame } from '../stores/gameStore';

export function TitleScreen() {
  const { booted, savedGame, startNew, continueGame } = useGame();
  return (
    <div className="title-screen">
      <div className="title-card">
        <div className="title-coin">金</div>
        <h1>TIỆM VÀNG ĐẠI GIA</h1>
        <p className="subtitle">Mô phỏng làm chủ tiệm vàng gia đình giữa lòng Sài Gòn</p>
        <div className="title-actions">
          {savedGame && (
            <button onClick={continueGame}>
              Tiếp tục — Ngày {savedGame.day} · {formatMillions(netWorth(savedGame))} · ⭐{savedGame.shop.reputation}
            </button>
          )}
          <button className={savedGame ? 'secondary' : ''} disabled={!booted} onClick={() => { if (!savedGame || confirm('Bắt đầu lại sẽ xóa tiến trình hiện tại. Tiếp tục?')) startNew(); }}>
            Chơi mới (vốn 500 triệu)
          </button>
        </div>
        <ul className="title-notes">
          <li>WASD di chuyển · Chuột nhìn · <kbd>E</kbd> tương tác · <kbd>H</kbd> hướng dẫn</li>
          <li>Tiến trình tự lưu trên trình duyệt (IndexedDB).</li>
          <li>Toàn bộ tiền, vàng, chuyển khoản và giá vàng là <b>dữ liệu giả lập</b> phục vụ giải trí.</li>
        </ul>
      </div>
    </div>
  );
}
