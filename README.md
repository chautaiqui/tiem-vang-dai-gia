# Tiệm Vàng Đại Gia — MVP 1.0

Webgame 3D góc nhìn thứ nhất mô phỏng làm chủ tiệm vàng gia đình ở Sài Gòn.
React + TypeScript + Vite, Three.js / React Three Fiber / Drei, Zustand, lưu tiến trình bằng IndexedDB.
Chạy hoàn toàn trên trình duyệt, không cần backend, không tải asset ngoài (mô hình low-poly dựng bằng code, âm thanh tổng hợp bằng WebAudio).

> Toàn bộ tiền, vàng, chuyển khoản và giá vàng trong game là **dữ liệu giả lập** phục vụ giải trí.

## Chạy

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit test nghiệp vụ + save game
npm run build      # bản tĩnh trong dist/ (deploy Nginx/static hosting)
```

Cần Node 18+ (máy này: `export PATH=~/.nvm/versions/node/v22.14.0/bin:$PATH`).

## Điều khiển

`WASD` di chuyển · chuột nhìn · `E` tương tác · `1`/`2` chọn câu thoại · `H` hướng dẫn · `Esc` đóng bảng / nhả chuột.

## Vòng chơi

1. Sáng: xem bảng giá + tin thị trường → đi tới cửa bấm `E` mở tiệm.
2. Khách vào (6 persona): mua, bán vàng cũ hoặc đổi vàng.
3. Lấy hàng ở **tủ trưng bày** → **cân** (trừ bì, chờ STABLE, ghi số) → **kiểm định** (đá thử + 3 loại nước thử, hoặc máy XRF) → **máy tính tiền**: báo giá, thương lượng → thanh toán tiền mặt / QR giả lập → **in hóa đơn**.
4. Hết khách: ra cửa đóng tiệm → báo cáo ngày, bán vàng cũ cho xưởng nấu (lộ tuổi vàng thật), nhập hàng, nâng cấp → sang ngày mới (tự lưu).

Cơ chế chính: cân sai có lợi cho tiệm bị khách phát hiện (khách khó tính soi tới 0,02 g); kiểm định sai = mua hớ;
ép giá quá đà làm khách bỏ đi và mất uy tín; uy tín quyết định số khách; cấp 2 mở khóa trang sức 18K/14K, tủ kính cao cấp, máy XRF.

## Cấu trúc

```
src/
├── game/logic/      # nghiệp vụ thuần TS, có unit test — không phụ thuộc React/Three
│   ├── units.ts         tiền = số nguyên VNĐ, trọng lượng = số nguyên mg, làm tròn half-up tường minh
│   ├── gold.ts          tuổi vàng, hàm lượng (phần vạn)
│   ├── pricing.ts       giá giả lập theo ngày, spread mua/bán, sự kiện thị trường, giá xưởng
│   ├── products.ts      10 mẫu sản phẩm, vàng cũ khách mang tới
│   ├── customers.ts     6 persona, sinh khách theo ngày, hội thoại tiếng Việt
│   ├── negotiation.ts   mô hình thương lượng (tỉ lệ "chênh so với giá công bằng")
│   ├── weighing.ts      cân: khay, trừ bì, thời gian ổn định, sai số
│   ├── inspection.ts    đá thử / nước thử / XRF
│   └── game.ts          GameState, giao dịch, tồn kho, nhập hàng, xưởng nấu, nâng cấp, báo cáo ngày
├── game/scene/      # 3D: cửa hàng, người chơi FPS, NPC waypoint, vật cầm tay
├── stores/          # Zustand: vòng đời khách + giao dịch đang diễn ra
├── services/        # IndexedDB save, âm thanh WebAudio
└── components/      # HUD + các bảng mini-game (cân, kiểm định, POS, hóa đơn, báo cáo…)
```

Trong bản dev, store được gắn vào `window.__game` để debug / tự động chơi thử.

## Khác với kế hoạch ban đầu

- Không dùng GLB từ Blender: toàn bộ mô hình là low-poly dựng bằng code → tải nhanh, không cần asset. Có thể thay dần bằng GLB.
- Gom nghiệp vụ vào `src/game/logic/` (thay vì `src/features/*`) để test độc lập với UI.
- CSS thuần thay vì Tailwind.
