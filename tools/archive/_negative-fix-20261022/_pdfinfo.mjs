/**
 * 极简 PDF 解析:数页数、读每页 MediaBox、看是否分页
 * (不引入依赖,直接解析 /Type /Page 与 /MediaBox)
 */
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

const path = process.argv[2]
const buf = readFileSync(path)
const raw = buf.toString('latin1')

// ① 页数
const pageObjs = [...raw.matchAll(/\/Type\s*\/Page[^s]/g)].length
const countMatch = raw.match(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/)
console.log('=== PDF 基本信息 ===')
console.log('   文件大小:', buf.length, 'bytes')
console.log('   /Type /Page 出现次数:', pageObjs)
console.log('   /Pages /Count 值:', countMatch ? countMatch[1] : '(未找到)')

// ② 每页 MediaBox
const boxes = [...raw.matchAll(/\/MediaBox\s*\[\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s*\]/g)]
console.log('\n   MediaBox 个数:', boxes.length)
for (const b of boxes.slice(0, 5)) {
  const w = Number(b[3]) - Number(b[1])
  const h = Number(b[4]) - Number(b[2])
  console.log(`     ${w.toFixed(2)} x ${h.toFixed(2)} pt  = ${(w / 72 * 25.4).toFixed(1)} x ${(h / 72 * 25.4).toFixed(1)} mm`)
}

// ③ A4 对照
console.log('\n   标准 A4 = 210.0 x 297.0 mm (595.28 x 841.89 pt)')

// ④ 提取内容流里的文本绘制位置:用 Tj/TJ 的操作符粗看内容纵向分布
let textOps = 0
const streams = [...raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)]
console.log('\n   内容流个数:', streams.length)
for (const s of streams.slice(0, 3)) {
  let data = s[1]
  try {
    const inf = inflateSync(Buffer.from(data, 'latin1'))
    const txt = inf.toString('latin1')
    const tj = [...txt.matchAll(/\bTj\b|\bTJ\b/g)].length
    textOps += tj
    const yPos = [...txt.matchAll(/([\d.]+)\s+([\d.]+)\s+TD|\bTd\b/g)]
    console.log(`     解压后长度 ${txt.length}, Tj/TJ 数 ${tj}, Td 定位数 ${yPos.length}`)
    // 找最大 y(Td 的第二个数)
    const ys = [...txt.matchAll(/([\d.\-]+)\s+([\d.\-]+)\s+Td/g)].map((m) => Number(m[2]))
    if (ys.length) console.log(`     文本 y 范围: ${Math.min(...ys).toFixed(1)} ~ ${Math.max(...ys).toFixed(1)}`)
  } catch {
    console.log('     (流非 zlib,跳过)')
  }
}
