import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, '../public/icons');

// Simple CRC32 implementation for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crcTarget = chunk.subarray(4, 8 + len);
  chunk.writeUInt32BE(crc32(crcTarget), 8 + len);
  return chunk;
}

function generatePngBuffer(size) {
  const width = size;
  const height = size;
  const scanlines = [];

  const center = size / 2;
  const radius = size * 0.44;

  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const idx = 1 + x * 4;

      // Distance from center for rounded container
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Check if inside rounded square / circle base
      let r = 0, g = 0, b = 0, a = 0;

      // Rounded container
      const cornerRadius = size * 0.22;
      const qx = Math.max(0, Math.abs(dx) - (center - cornerRadius));
      const qy = Math.max(0, Math.abs(dy) - (center - cornerRadius));
      const distCorner = Math.sqrt(qx * qx + qy * qy);

      if (distCorner <= cornerRadius) {
        // Gradient from vibrant indigo (99, 102, 241) to modern cyan (6, 182, 212)
        const t = (x + y) / (width + height);
        r = Math.round(99 * (1 - t) + 6 * t);
        g = Math.round(102 * (1 - t) + 182 * t);
        b = Math.round(241 * (1 - t) + 212 * t);
        a = 255;

        // Draw white Play Triangle in center
        // Triangle points: (x1, y1), (x2, y2), (x3, y3)
        const triLeft = center - size * 0.16;
        const triRight = center + size * 0.22;
        const triTop = center - size * 0.22;
        const triBottom = center + size * 0.22;

        if (x >= triLeft && x <= triRight) {
          const progress = (x - triLeft) / (triRight - triLeft);
          const currentTop = triTop + progress * (center - triTop);
          const currentBottom = triBottom - progress * (triBottom - center);
          if (y >= currentTop && y <= currentBottom) {
            r = 255;
            g = 255;
            b = 255;
            a = 255;
          }
        }
      }

      row[idx] = r;
      row[idx + 1] = g;
      row[idx + 2] = b;
      row[idx + 3] = a;
    }
    scanlines.push(row);
  }

  const rawData = Buffer.concat(scanlines);
  const compressedData = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: RGBA
  ihdrData[10] = 0; // Compression: Deflate
  ihdrData[11] = 0; // Filter: 0
  ihdrData[12] = 0; // Interlace: 0
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

[16, 48, 128].forEach((size) => {
  const buf = generatePngBuffer(size);
  const filePath = path.join(outputDir, `icon-${size}.png`);
  fs.writeFileSync(filePath, buf);
  console.log(`Generated: ${filePath} (${buf.length} bytes)`);
});
