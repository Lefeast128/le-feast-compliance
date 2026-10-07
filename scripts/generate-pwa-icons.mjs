import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";

const outputDirectory = new URL("../public/icons/", import.meta.url);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const payload = Buffer.concat([typeBuffer, data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(payload), 0);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  return Buffer.concat([length, payload, checksum]);
}

function roundedRectangle(pixels, size, left, top, right, bottom, radius, color) {
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const nearLeft = x < left + radius;
      const nearRight = x >= right - radius;
      const nearTop = y < top + radius;
      const nearBottom = y >= bottom - radius;
      const dx = nearLeft ? left + radius - x : nearRight ? x - (right - radius - 1) : 0;
      const dy = nearTop ? top + radius - y : nearBottom ? y - (bottom - radius - 1) : 0;
      if ((nearLeft || nearRight) && (nearTop || nearBottom) && dx * dx + dy * dy > radius * radius) continue;
      const index = (y * size + x) * 4;
      pixels[index] = color[0];
      pixels[index + 1] = color[1];
      pixels[index + 2] = color[2];
      pixels[index + 3] = 255;
    }
  }
}

function rectangle(pixels, size, left, top, right, bottom, color) {
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const index = (y * size + x) * 4;
      pixels[index] = color[0];
      pixels[index + 1] = color[1];
      pixels[index + 2] = color[2];
      pixels[index + 3] = 255;
    }
  }
}

function makeIcon(size, maskable) {
  const dark = [31, 36, 33];
  const yellow = [255, 222, 89];
  const white = [255, 255, 255];
  const pixels = Buffer.alloc(size * size * 4);
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = dark[0];
    pixels[index + 1] = dark[1];
    pixels[index + 2] = dark[2];
    pixels[index + 3] = 255;
  }

  const padding = maskable ? Math.round(size * 0.19) : Math.round(size * 0.13);
  const radius = Math.round(size * 0.14);
  roundedRectangle(pixels, size, padding, padding, size - padding, size - padding, radius, yellow);

  const stroke = Math.max(4, Math.round(size * 0.095));
  const top = Math.round(size * 0.3);
  const bottom = Math.round(size * 0.7);
  const left = Math.round(size * 0.31);
  const middle = Math.round(size * 0.53);
  const right = Math.round(size * 0.7);
  rectangle(pixels, size, left, top, left + stroke, bottom, white);
  rectangle(pixels, size, left, bottom - stroke, middle, bottom, white);
  rectangle(pixels, size, middle, top, middle + stroke, bottom, white);
  rectangle(pixels, size, middle, top, right, top + stroke, white);
  rectangle(pixels, size, middle, Math.round(size * 0.48), Math.round(size * 0.66), Math.round(size * 0.48) + stroke, white);

  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    scanlines[(size * 4 + 1) * y] = 0;
    pixels.copy(scanlines, (size * 4 + 1) * y + 1, y * size * 4, (y + 1) * size * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

await mkdir(outputDirectory, { recursive: true });
const assets = [
  ["icon-192.png", makeIcon(192, false)],
  ["icon-512.png", makeIcon(512, false)],
  ["icon-maskable-192.png", makeIcon(192, true)],
  ["icon-maskable-512.png", makeIcon(512, true)],
  ["apple-touch-icon.png", makeIcon(180, false)],
];

for (const [filename, contents] of assets) {
  await writeFile(new URL(filename, outputDirectory), contents);
}
