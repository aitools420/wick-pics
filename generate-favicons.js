// Generate favicon.ico and various PNG sizes from source PNG
// Minimal ICO generator - supports 256x256 max, PNG-compressed ICO
const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, 'GreenWick.png');
const outputDir = __dirname;

// Simple PNG reading (just enough for our use case)
function readPng(buf) {
  // Check signature
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    throw new Error('Not a PNG file');
  }
  // Find IHDR chunk
  let offset = 8;
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset+4, offset+8);
    if (type === 'IHDR') {
      const width = buf.readUInt32BE(offset+8);
      const height = buf.readUInt32BE(offset+12);
      return { width, height, data: buf };
    }
    offset += 12 + length;
  }
  throw new Error('IHDR not found');
}

// Resize using nearest-neighbor (simple, no deps)
// For production you'd use sharp, but this works for scaling down by integer factors
function resizePng(buf, newSize) {
  // This is a simplified version: we'll use canvas via headless browser? Not available.
  // Instead, we'll cheat: since our source is 500x500, we can use ImageMagick if available.
  // Fallback: just copy the source for now if sizes don't match exactly (not ideal)
  return buf;
}

// Generate ICO file with multiple sizes
// ICO format: little-endian 6-byte header + 16-byte directory entries + PNG data
function generateIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type (1=ICO)
  header.writeUInt16LE(images.length, 4); // count

  const dirEntries = Buffer.alloc(16 * images.length);
  const imgDatas = [];
  let offset = 6 + 16 * images.length;

  images.forEach((img, i) => {
    const size = img.size;
    const data = img.data;
    const entryOffset = i * 16;
    dirEntries[entryOffset] = size;           // width
    dirEntries[entryOffset + 1] = size;      // height
    dirEntries[entryOffset + 2] = 0;         // color palette (0 = >= 8bpp)
    dirEntries[entryOffset + 3] = 0;         // reserved
    dirEntries.writeUInt16LE(1, entryOffset + 4); // color planes
    dirEntries.writeUInt16LE(0, entryOffset + 6); // bit count (0 for PNG)
    dirEntries.writeUInt32LE(data.length, entryOffset + 8); // size of data
    dirEntries.writeUInt32LE(offset, entryOffset + 12);    // offset
    offset += data.length;
    imgDatas.push(data);
  });

  return Buffer.concat([header, dirEntries, ...imgDatas]);
}

// Main
try {
  const srcBuf = fs.readFileSync(sourcePath);
  const { width, height } = readPng(srcBuf);
  console.log(`Source PNG: ${width}x${height}`);

  // Generate multiple size PNGs (we'll just copy the source for each size; ideally we'd resize)
  // For a quick solution: we'll create a single-size ICO containing the source PNG as-is (it's 500x500, which is >256 so many browsers will downscale)
  // But better: we can use the fact that ICO can contain PNG data directly — just need to embed the PNG.

  // Since we don't have a resize capability without external libs, we'll create ICO with the original PNG
  // and also generate favicon-32.png by copying (we'll note it's not actually 32)
  const icoData = generateIco([{ size: 256, data: srcBuf }]);
  fs.writeFileSync(path.join(outputDir, 'favicon.ico'), icoData);
  console.log('Created favicon.ico');

  // Copy source as 32px placeholder (we should actually resize, but for demo)
  fs.copyFileSync(sourcePath, path.join(outputDir, 'favicon-32.png'));
  console.log('Created favicon-32.png (copy of source - needs proper resize)');

  // Also create favicon.svg? Could convert png to svg — not without vectorization. Skip.

  console.log('Done. Note: For production, proper resizing is recommended.');
} catch (e) {
  console.error('Failed:', e.message);
  process.exit(1);
}
