/**
 * Generates /public/icon-192.png and /public/icon-512.png — a procedurally
 * drawn pixel-art grass block. Uses only Node built-ins (zlib for PNG deflate).
 * Usage: node scripts/make-icons.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let table = crc32.t;
  if (!table) {
    table = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** Encode RGBA pixel data as PNG. */
function encodePNG(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function rand(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Draw a 16x16 grass block face, scaled up to `size`. */
function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const scale = size / 16;
  const px = (x, y, [r, g, b]) => {
    for (let sy = 0; sy < scale; sy++)
      for (let sx = 0; sx < scale; sx++) {
        const i = ((y * scale + sy) * size + x * scale + sx) * 4;
        rgba[i] = r;
        rgba[i + 1] = g;
        rgba[i + 2] = b;
        rgba[i + 3] = 255;
      }
  };
  const rng = rand(7);
  // dirt base
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const shade = 0.85 + rng() * 0.3;
      px(x, y, [Math.floor(134 * shade), Math.floor(96 * shade), Math.floor(67 * shade)]);
    }
  // grass top band
  for (let x = 0; x < 16; x++) {
    const h = 4 + Math.floor(rng() * 3);
    for (let y = 0; y < h; y++) {
      const shade = 0.8 + rng() * 0.35;
      px(x, y, [Math.floor(92 * shade), Math.floor(150 * shade), Math.floor(56 * shade)]);
    }
  }
  return encodePNG(size, rgba);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-512.png', drawIcon(512));
writeFileSync('public/icon-192.png', drawIcon(192));
console.log('icons written');
