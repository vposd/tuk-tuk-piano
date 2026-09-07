/* Генератор PNG-иконок без зависимостей: node tools/make-icons.js */
'use strict';

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'icons');

/* ---------- минимальный PNG-энкодер ---------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;                                  // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 6;    // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- рисование ---------- */

function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h / 60) % 6];
  return [(seg[0] + m) * 255, (seg[1] + m) * 255, (seg[2] + m) * 255];
}

function mix(a, b, k) {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function inRoundRect(px, py, x, y, w, h, r) {
  if (px < x || py < y || px > x + w || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

const BARS = [
  { hue: 350, h: 0.44 },
  { hue: 20, h: 0.62 },
  { hue: 45, h: 0.82 },
  { hue: 150, h: 0.70 },
  { hue: 190, h: 0.52 },
  { hue: 265, h: 0.38 }
];

/* Одна иконка: тёмный скруглённый квадрат + шесть цветных клавиш. */
function draw(size, opts) {
  const ss = 3;                        // суперсэмплинг для сглаживания
  const W = size * ss;
  const acc = new Float64Array(size * size * 4);
  const inset = (opts.pad || 0) * W;   // отступ содержимого (для maskable)
  const bx = inset, by = inset, bw = W - inset * 2, bh = W - inset * 2;
  const bgRadius = opts.fullBleed ? 0 : W * 0.22;

  // геометрия клавиш
  const areaX = bx + bw * 0.14, areaW = bw * 0.72;
  const areaBottom = by + bh * 0.80, areaH = bh * 0.62;
  const gap = areaW * 0.055;
  const barW = (areaW - gap * (BARS.length - 1)) / BARS.length;
  const barR = barW * 0.34;

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      let col = null, alpha = 0;

      if (opts.fullBleed || inRoundRect(x, y, 0, 0, W - 1, W - 1, bgRadius)) {
        const ty = y / W, tx = x / W;
        col = mix([26, 17, 64], [50, 24, 84], ty * 0.9);            // тёмный градиент
        const gx = tx - 0.25, gy = ty - 0.1;
        const glow = Math.max(0, 1 - Math.sqrt(gx * gx + gy * gy) * 1.9);
        col = mix(col, [92, 60, 190], glow * 0.55);
        alpha = 255;
      }

      for (let i = 0; i < BARS.length; i++) {
        const b = BARS[i];
        const h = areaH * b.h;
        const x0 = areaX + i * (barW + gap);
        const y0 = areaBottom - h;
        if (inRoundRect(x, y, x0, y0, barW, h, Math.min(barR, h / 2))) {
          const k = (y - y0) / h;
          col = mix(hsl(b.hue, 95, 72), hsl(b.hue + 14, 85, 52), Math.min(1, k * 1.15));
          alpha = 255;
          break;
        }
      }

      if (!alpha) continue;
      const oi = (Math.floor(y / ss) * size + Math.floor(x / ss)) * 4;
      acc[oi] += col[0]; acc[oi + 1] += col[1]; acc[oi + 2] += col[2]; acc[oi + 3] += alpha;
    }
  }

  const n = ss * ss;
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const a = acc[i * 4 + 3] / n;
    const cov = a / 255;
    rgba[i * 4] = cov ? Math.round(acc[i * 4] / n / cov) : 0;
    rgba[i * 4 + 1] = cov ? Math.round(acc[i * 4 + 1] / n / cov) : 0;
    rgba[i * 4 + 2] = cov ? Math.round(acc[i * 4 + 2] / n / cov) : 0;
    rgba[i * 4 + 3] = Math.round(a);
  }
  return encodePNG(size, size, rgba);
}

fs.mkdirSync(OUT, { recursive: true });
const files = [
  ['icon-192.png', draw(192, {})],
  ['icon-512.png', draw(512, {})],
  ['icon-maskable-512.png', draw(512, { pad: 0.13, fullBleed: true })]
];
for (const [name, buf] of files) {
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log('written', name, buf.length + ' bytes');
}
