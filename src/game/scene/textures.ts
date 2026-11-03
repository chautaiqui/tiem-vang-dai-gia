import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { KARATS, TRADED_KARATS } from '../logic/gold';
import type { DayPrices } from '../logic/pricing';

const FONT = '"Be Vietnam Pro", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

export function priceBoardTexture(prices: DayPrices): CanvasTexture {
  return canvasTexture(1024, 400, (c) => {
    c.fillStyle = '#120404';
    c.fillRect(0, 0, 1024, 400);
    c.strokeStyle = '#d4a017';
    c.lineWidth = 8;
    c.strokeRect(8, 8, 1008, 384);
    c.fillStyle = '#ffd34d';
    c.font = `bold 46px ${FONT}`;
    c.textAlign = 'center';
    c.fillText(`BẢNG GIÁ VÀNG — NGÀY ${prices.day}`, 512, 64);
    c.font = `bold 30px ${FONT}`;
    c.fillStyle = '#ff6b4a';
    c.textAlign = 'left';
    c.fillText('LOẠI', 60, 120);
    c.textAlign = 'right';
    c.fillText('MUA VÀO', 690, 120);
    c.fillText('BÁN RA', 960, 120);
    TRADED_KARATS.forEach((k, i) => {
      const y = 186 + i * 64;
      c.textAlign = 'left';
      c.fillStyle = '#ffe9a8';
      c.font = `bold 40px ${FONT}`;
      c.fillText(k === 'K24' ? 'Nhẫn 9999' : `Vàng ${KARATS[k].short}`, 60, y);
      c.textAlign = 'right';
      c.font = `bold 44px "Courier New", monospace`;
      c.fillStyle = '#39ff7a';
      c.fillText(fmt(prices.table[k].buy), 690, y);
      c.fillStyle = '#ff4d4d';
      c.fillText(fmt(prices.table[k].sell), 960, y);
    });
    c.textAlign = 'center';
    c.fillStyle = '#b89a5a';
    c.font = `24px ${FONT}`;
    c.fillText('Đơn vị: đồng/chỉ · GIÁ GIẢ LẬP · TIỀN ẢO', 512, 382);
  });
}

export function signTexture(): CanvasTexture {
  return canvasTexture(1024, 200, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 200);
    g.addColorStop(0, '#b3121b');
    g.addColorStop(1, '#7a0a10');
    c.fillStyle = g;
    c.fillRect(0, 0, 1024, 200);
    c.strokeStyle = '#f2c14e';
    c.lineWidth = 10;
    c.strokeRect(10, 10, 1004, 180);
    c.fillStyle = '#ffd75e';
    c.textAlign = 'center';
    c.font = `bold 92px ${FONT}`;
    c.fillText('TIỆM VÀNG ĐẠI GIA', 512, 118);
    c.font = `28px ${FONT}`;
    c.fillText('Uy tín · Chất lượng · Cân đủ tuổi đủ', 512, 168);
  });
}

export function floorTexture(): CanvasTexture {
  const tex = canvasTexture(256, 256, (c) => {
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        c.fillStyle = (x + y) % 2 ? '#e9e1d3' : '#f4eee4';
        c.fillRect(x * 128, y * 128, 128, 128);
      }
    }
    c.strokeStyle = '#cfc4b0';
    c.lineWidth = 2;
    for (let i = 0; i <= 256; i += 128) {
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 256); c.stroke();
      c.beginPath(); c.moveTo(0, i); c.lineTo(256, i); c.stroke();
    }
  });
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(6, 4.5);
  return tex;
}

export function streetTexture(): CanvasTexture {
  return canvasTexture(1024, 512, (c) => {
    const sky = c.createLinearGradient(0, 0, 0, 300);
    sky.addColorStop(0, '#8fc9ff');
    sky.addColorStop(1, '#e8f4ff');
    c.fillStyle = sky;
    c.fillRect(0, 0, 1024, 512);
    const colors = ['#e8b04a', '#d96c5f', '#7fb0a8', '#e0d6a8', '#b38fc9', '#f0a35e'];
    for (let i = 0; i < 9; i++) {
      const w = 90 + ((i * 37) % 60);
      const h = 160 + ((i * 53) % 120);
      const x = i * 118;
      c.fillStyle = colors[i % colors.length];
      c.fillRect(x, 330 - h, w, h);
      c.fillStyle = 'rgba(255,255,255,0.55)';
      for (let wy = 330 - h + 20; wy < 310; wy += 40) for (let wx = x + 12; wx < x + w - 20; wx += 30) c.fillRect(wx, wy, 16, 22);
    }
    c.fillStyle = '#6d6d6d';
    c.fillRect(0, 330, 1024, 182);
    c.fillStyle = '#9a9a9a';
    c.fillRect(0, 330, 1024, 24);
    c.fillStyle = '#f5f5f5';
    for (let x = 0; x < 1024; x += 120) c.fillRect(x, 430, 60, 8);
  });
}
