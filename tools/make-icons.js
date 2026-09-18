// Generates the Airtime icon set (16, 32, 48, 128) as PNG files.
// No dependencies — run with: node tools/make-icons.js
//
// The icon: indigo->violet gradient rounded square with a white clock.

const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "icons");
const SIZES = [16, 32, 48, 128];
const SUPER = 4; // supersampling factor for anti-aliasing

// --- minimal PNG encoder ---

function crc32(buf) {
  const table = crc32.table || (crc32.table = buildTable());
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}
function buildTable() {
  const t = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const rowBytes = width * 4;
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (rowBytes + 1)] = 0; // filter: none
    rgba.copy(raw, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// --- drawing ---

const INDIGO = [99, 102, 241];
const VIOLET = [139, 92, 246];
const WHITE = [255, 255, 255];

function drawIcon(size) {
  const s = size * SUPER;
  const buf = Buffer.alloc(s * s * 4);

  const radius = s * 0.22; // corner radius of the rounded square
  const cx = s / 2;
  const cy = s / 2;
  const ringR = s * 0.30;
  const ringW = Math.max(2, s * 0.055);
  const handW = ringW;

  // minute hand pointing up, hour hand pointing to ~4 o'clock
  const hands = [
    { x1: cx, y1: cy, x2: cx, y2: cy - ringR * 0.62 },
    { x1: cx, y1: cy, x2: cx + ringR * 0.48, y2: cy + ringR * 0.30 },
  ];

  const inset = s - radius;
  for (let y = 0; y < s; y++) {
    const t = y / Math.max(1, s - 1);
    const bg = [
      Math.round(INDIGO[0] + (VIOLET[0] - INDIGO[0]) * t),
      Math.round(INDIGO[1] + (VIOLET[1] - INDIGO[1]) * t),
      Math.round(INDIGO[2] + (VIOLET[2] - INDIGO[2]) * t),
    ];
    for (let x = 0; x < s; x++) {
      // rounded-square coverage
      let inside = false;
      if (x >= radius && x <= inset && y >= 0 && y <= s) inside = true;
      else if (x >= 0 && x <= s && y >= radius && y <= inset) inside = true;
      else {
        const corners = [
          [radius, radius],
          [inset, radius],
          [radius, inset],
          [inset, inset],
        ];
        for (const [ccx, ccy] of corners) {
          if ((x - ccx) ** 2 + (y - ccy) ** 2 <= radius * radius) inside = true;
        }
      }

      const i = (y * s + x) * 4;
      if (!inside) continue; // transparent

      let [r, g, b] = bg;

      // clock: ring + hands in white
      const d = ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) ** 0.5;
      const onRing = Math.abs(d - ringR) <= ringW / 2;
      let onHand = false;
      if (!onRing) {
        for (const h of hands) {
          if (distToSegment(x + 0.5, y + 0.5, h) <= handW / 2) {
            onHand = true;
            break;
          }
        }
      }
      if (onRing || onHand) {
        r = WHITE[0];
        g = WHITE[1];
        b = WHITE[2];
      }

      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = 255;
    }
  }

  // downsample (box average) to the final size
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = 0; dy < SUPER; dy++) {
        for (let dx = 0; dx < SUPER; dx++) {
          const si = (((y * SUPER + dy) * s + x * SUPER + dx)) * 4;
          r += buf[si];
          g += buf[si + 1];
          b += buf[si + 2];
          a += buf[si + 3];
        }
      }
      const n = SUPER * SUPER;
      const oi = (y * size + x) * 4;
      out[oi] = Math.round(r / n);
      out[oi + 1] = Math.round(g / n);
      out[oi + 2] = Math.round(b / n);
      out[oi + 3] = Math.round(a / n);
    }
  }
  return out;
}

function distToSegment(px, py, seg) {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - seg.x1) * dx + (py - seg.y1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const nx = px - (seg.x1 + t * dx);
  const ny = py - (seg.y1 + t * dy);
  return Math.sqrt(nx * nx + ny * ny);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const png = encodePNG(size, size, drawIcon(size));
  fs.writeFileSync(path.join(OUT_DIR, `icon${size}.png`), png);
  console.log(`✓ icons/icon${size}.png (${png.length} bytes)`);
}