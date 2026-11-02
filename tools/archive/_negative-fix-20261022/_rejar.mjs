/**
 * 安全地替换 jar 里的 BOOT-INF/classes/static 目录:
 *   - 只动 static/**,其余条目(尤其 BOOT-INF/lib/*.jar)**原样字节复制**
 *   - 保持每个条目原有的压缩方式(嵌套 jar 必须按原方式存,否则类加载失败)
 *   - 顺带清掉误放的根 static/
 *
 * 纯 Node 实现 ZIP(无依赖):解析中央目录 → 复制未改动条目 → 写入新的 static 条目。
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { deflateRawSync } from 'node:zlib'

/** 标准 CRC-32(ZIP 用),node:zlib 不导出 crc32,自行实现 */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const [jarPath, staticDir, outPath] = process.argv.slice(2)
if (!jarPath || !staticDir || !outPath) {
  console.error('用法: node _rejar.mjs <jar> <staticDir> <out>')
  process.exit(1)
}

const buf = readFileSync(jarPath)

// ── 找 End of Central Directory ──
function findEocd(b) {
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (b.readUInt32LE(i) === 0x06054b50) return i
  }
  return -1
}
const eocd = findEocd(buf)
if (eocd < 0) throw new Error('不是有效的 ZIP/JAR')
const cdCount = buf.readUInt16LE(eocd + 10)
const cdOffset = buf.readUInt32LE(eocd + 16)
console.log('中央目录条目数:', cdCount)

// ── 遍历中央目录 ──
const entries = []
let p = cdOffset
for (let i = 0; i < cdCount; i++) {
  if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('中央目录损坏 @' + p)
  const method = buf.readUInt16LE(p + 10)
  const crc = buf.readUInt32LE(p + 16)
  const csize = buf.readUInt32LE(p + 20)
  const usize = buf.readUInt32LE(p + 24)
  const nameLen = buf.readUInt16LE(p + 28)
  const extraLen = buf.readUInt16LE(p + 30)
  const commentLen = buf.readUInt16LE(p + 32)
  const localOff = buf.readUInt32LE(p + 42)
  const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8')
  // 本地头里取实际数据
  const lNameLen = buf.readUInt16LE(localOff + 26)
  const lExtraLen = buf.readUInt16LE(localOff + 28)
  const dataStart = localOff + 30 + lNameLen + lExtraLen
  const data = buf.subarray(dataStart, dataStart + csize)
  entries.push({ name, method, crc, csize, usize, data, localExtra: buf.subarray(localOff + 30 + lNameLen, dataStart) })
  p += 46 + nameLen + extraLen + commentLen
}
console.log('解析条目:', entries.length)

// ── 保留:除了 static/** 与 根 static/ 之外全部保留 ──
const keep = entries.filter((e) => !e.name.startsWith('BOOT-INF/classes/static/') && !e.name.startsWith('static/'))
const dropped = entries.length - keep.length
console.log('保留条目:', keep.length, ' 丢弃(旧 static):', dropped)

// ── 收集新 static 文件 ──
function walk(dir, base = dir, out = []) {
  for (const f of readdirSync(dir)) {
    const full = join(dir, f)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, base, out)
    else out.push({ full, name: 'BOOT-INF/classes/static/' + relative(base, full).replace(/\\/g, '/') })
  }
  return out
}
const newFiles = walk(staticDir)
console.log('新 static 文件数:', newFiles.length)

// ── 构建新 ZIP ──
const out = []
const central = []
let offset = 0
const DOSTIME = ((12 << 11) | (0 << 5) | 0)
const DOSDATE = (((2026 - 1980) << 9) | (10 << 5) | 28)

function addEntry(name, method, crc, csize, usize, data, extra) {
  const nameBuf = Buffer.from(name, 'utf8')
  const lh = Buffer.alloc(30)
  lh.writeUInt32LE(0x04034b50, 0)
  lh.writeUInt16LE(20, 4)
  lh.writeUInt16LE(0, 6)
  lh.writeUInt16LE(method, 8)
  lh.writeUInt16LE(DOSTIME, 10)
  lh.writeUInt16LE(DOSDATE, 12)
  lh.writeUInt32LE(crc, 14)
  lh.writeUInt32LE(csize, 18)
  lh.writeUInt32LE(usize, 22)
  lh.writeUInt16LE(nameBuf.length, 26)
  lh.writeUInt16LE(extra.length, 28)
  out.push(lh, nameBuf, extra, data)

  const ch = Buffer.alloc(46)
  ch.writeUInt32LE(0x02014b50, 0)
  ch.writeUInt16LE(20, 4)
  ch.writeUInt16LE(20, 6)
  ch.writeUInt16LE(0, 8)
  ch.writeUInt16LE(method, 10)
  ch.writeUInt16LE(DOSTIME, 12)
  ch.writeUInt16LE(DOSDATE, 14)
  ch.writeUInt32LE(crc, 16)
  ch.writeUInt32LE(csize, 20)
  ch.writeUInt32LE(usize, 24)
  ch.writeUInt16LE(nameBuf.length, 28)
  ch.writeUInt16LE(0, 30)
  ch.writeUInt16LE(0, 32)
  ch.writeUInt16LE(0, 34)
  ch.writeUInt16LE(0, 36)
  ch.writeUInt32LE(0, 38)
  ch.writeUInt32LE(offset, 42)
  central.push(Buffer.concat([ch, nameBuf]))
  offset += lh.length + nameBuf.length + extra.length + data.length
}

// 原条目:字节原样复制(方法/CRC/大小都不变)
for (const e of keep) addEntry(e.name, e.method, e.crc, e.csize, e.usize, e.data, Buffer.alloc(0))
// 新 static:统一 deflate(文本资源)或不压缩
for (const f of newFiles) {
  const raw = readFileSync(f.full)
  const crc = crc32(raw) >>> 0
  const comp = deflateRawSync(raw, { level: 6 })
  addEntry(f.name, 8, crc, comp.length, raw.length, comp, Buffer.alloc(0))
}

const centralBuf = Buffer.concat(central)
const centralOffset = offset
out.push(centralBuf)
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0)
const total = keep.length + newFiles.length
end.writeUInt16LE(0, 4)
end.writeUInt16LE(0, 6)
end.writeUInt16LE(total, 8)
end.writeUInt16LE(total, 10)
end.writeUInt32LE(centralBuf.length, 12)
end.writeUInt32LE(centralOffset, 16)
end.writeUInt16LE(0, 20)
out.push(end)

writeFileSync(outPath, Buffer.concat(out))
console.log('已写出:', outPath)
console.log('新 jar 条目总数:', total)
