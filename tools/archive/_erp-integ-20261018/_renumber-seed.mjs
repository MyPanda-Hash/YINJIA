/* 一次性(临时,用完删):把迁移脚本 _seed 段里 @f 的「序号」列由 10/20/30 跳号改成 1/2/3 连续。
 * 规则:同一接口编码内按出现顺序从 1 递增;其余字节不动。
 * 用法:node _renumber-seed.mjs <sql 文件>
 */
import fs from 'node:fs'

const file = process.argv[2]
if (!file) { console.error('用法: node _renumber-seed.mjs <sql 文件>'); process.exit(2) }
const raw = fs.readFileSync(file, 'utf8')
const NL = raw.includes('\r\n') ? '\r\n' : '\n'
const lines = raw.split(NL)

let inSeed = false
const counter = new Map()
let changed = 0
const out = lines.map((line) => {
  if (/^INSERT INTO @f VALUES\s*$/.test(line.trim()) || /^INSERT INTO @f VALUES$/.test(line.trim())) { inSeed = true; return line }
  if (inSeed && /^;$/.test(line.trim())) { inSeed = false; return line }
  if (!inSeed) return line
  // (N'接口编码', 10, N'表头', N'MES字段', ...
  const m = line.match(/^\(N'([^']+)',\s*(\d+),/)
  if (!m) return line
  const code = m[1]
  const next = (counter.get(code) || 0) + 1
  counter.set(code, next)
  if (Number(m[2]) !== next) changed++
  return line.replace(/^(\(N'[^']+',\s*)\d+(,)/, `$1${next}$2`)
})

fs.writeFileSync(file, out.join(NL), 'utf8')
console.log(`[OK] 重编号 ${changed} 行;接口数 ${counter.size}`)
for (const [code, n] of counter) if (n > 100) console.log(`  ${code}: ${n} 行`)
