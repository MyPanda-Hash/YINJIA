/** 逐条 dry-parse:用 SET PARSEONLY 或 事务回滚 的方式定位报错语句 */
const fs = require('node:fs')
const src = fs.readFileSync('D:/YINJIA-main/tools/balance-negative-stock.js', 'utf8')
const lines = src.split('\n')
const PATTERN = /:([A-Za-z_][A-Za-z0-9_]*)/g
const params = { m: 0.0001, u: 'admin', w: 'X', c: 'CK', l: '', q: 1, d: '2026-10-13', no: 'N1', p: 'OTHER_IN', at: '2026-10-13 17:30:00',
  src: 3, rid: 1, dt: '其他入库单', wn: 'a', ws: 'b', uom: 'c', ckn: 'd', lot: null, px: 1, je: 1, bt: '其他入库', btc: 'x', bti: '12',
  sc: null, sn: null, rmk: 'r', ct: 't', n: 'n', s: 's', who: 'w', bal: 1, inq: 1, outq: 1, id: 1, sn2: 1 }
// 找出所有 exec/query 的模板字符串,展开后是否残留 ':'
let inSql = false, buf = [], startLine = 0, hits = 0
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  if (!inSql && /(p\.exec|p\.query|send)\(`/.test(line)) { inSql = true; buf = []; startLine = i + 1 }
  if (inSql) {
    buf.push(line)
    const joined = buf.join('\n')
    // 粗略:看 `:xxx` 里 xxx 是否不在 params 里
    const bad = [...joined.matchAll(PATTERN)].map((m) => m[1]).filter((n) => !(n in params))
    if (joined.includes('`,') || /\}\s*\)/.test(line) || (line.includes('`)') && buf.length > 1)) {
      if (bad.length) { hits++; console.log(`第 ${startLine} 行起: 未覆盖的占位符 ${[...new Set(bad)].join(',')}  ——  ${buf[buf.length - 1].trim().slice(0, 80)}`) }
      inSql = false
    }
  }
}
console.log('可疑段数:', hits)
