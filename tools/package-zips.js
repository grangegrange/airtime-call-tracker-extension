// Packages dist/chrome and dist/firefox into ready-to-upload ZIP archives.
// Zero dependencies (ZIP "store" method + manual CRC-32). Run with: npm run package
const fs = require("fs");
const path = require("path");

let crcTable;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function walk(dir, prefix) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (fs.statSync(fp).isDirectory()) out.push(...walk(fp, rel));
    else out.push({ rel, data: fs.readFileSync(fp) });
  }
  return out;
}

function zip(files) {
  const chunks = [];
  const central = [];
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const f of files) {
    const crc = crc32(f.data);
    const nameBuff = Buffer.from(f.rel, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
    local.writeUInt16LE(0, 8); // method: store
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(f.data.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(nameBuff.length, 26);
    local.writeUInt16LE(0, 28);

    const offset = chunks.reduce((n, c) => n + c.length, 0);
    chunks.push(local, nameBuff, f.data);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(dosTime, 12);
    ch.writeUInt16LE(dosDate, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(f.data.length, 20);
    ch.writeUInt32LE(f.data.length, 24);
    ch.writeUInt16LE(nameBuff.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, nameBuff);
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const centralOffset = chunks.reduce((n, c) => n + c.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([...chunks, ...central, eocd]);
}

for (const target of ["chrome", "firefox"]) {
  const files = walk(path.join("dist", target));
  const out = `dist/airtime-${target}.zip`;
  fs.writeFileSync(out, zip(files));
  console.log(`ok ${out} (${files.length} files)`);
}