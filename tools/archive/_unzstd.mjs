// 一次性工具:把 DSH 会话的 .jsonl.zstd(多帧拼接)逐帧解成明文,供检索历史对话
import fs from 'node:fs'
import zlib from 'node:zlib'

const [src, out] = process.argv.slice(2)
const buf = fs.readFileSync(src)
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
const starts = []
for (let i = 0; i + 4 <= buf.length; i++) {
  if (buf[i] === 0x28 && buf[i + 1] === 0xb5 && buf[i + 2] === 0x2f && buf[i + 3] === 0xfd) starts.push(i)
}
if (!starts.length || starts[0] !== 0) starts.unshift(0)
const parts = []
let i = 0
while (i < starts.length) {
  let done = false
  // 从当前帧起点往后试:解码失败就把下一帧起点并入(应对魔术字误命中)
  for (let j = i + 1; j <= starts.length; j++) {
    const end = j < starts.length ? starts[j] : buf.length
    try {
      parts.push(zlib.zstdDecompressSync(buf.subarray(starts[i], end)))
      i = j
      done = true
      break
    } catch { /* 继续并入下一段 */ }
  }
  if (!done) { console.error('无法解码的帧起点', starts[i]); break }
}
fs.writeFileSync(out, Buffer.concat(parts))
console.log('frames', parts.length, 'bytes', fs.statSync(out).size)
