// _chk-insp-fill.mjs — 自检:断言⑧ 的表头块占位模拟**不是空转**(改坏一处必须报错)
// 用法:node tools/archive/_chk-insp-fill.mjs   (在 frontend/ 下跑,它 import 前端配置)
import { recordSheetConfigs } from '../../frontend/src/core/views/recordSheetConfigs.js'

function simulate(cfg) {
  const n = cfg.grid.length
  const rows = (cfg.sections || []).flatMap((s) => s.rows || [])
  const occ = rows.map(() => new Array(n).fill(false))
  const log = []
  for (const [ri, row] of rows.entries()) {
    let col = 0
    for (const p of row.pairs || []) {
      const lspan = p.lspan || 1, vspan = p.vspan || 1, rowspan = p.rowspan || 1
      const need = lspan + vspan
      while (col < n && occ[ri][col]) col++
      if (col + need > n) return { ok: false, why: `第 ${ri + 1} 行「${p.label}」越界`, log }
      const from = col
      for (let c = col; c < col + need; c++) occ[ri][c] = true
      col += need
      for (let rr = ri + 1; rr < Math.min(ri + rowspan, rows.length); rr++)
        for (let c = from; c < from + need; c++) occ[rr][c] = true
      log.push(`r${ri + 1} ${p.label} → 列 ${from + 1}..${from + need}${rowspan > 1 ? ` (rowspan ${rowspan})` : ''}`)
    }
  }
  for (const [ri, row] of occ.entries()) {
    const hole = row.indexOf(false)
    if (hole >= 0) return { ok: false, why: `第 ${ri + 1} 行第 ${hole + 1} 格空着`, log }
  }
  return { ok: true, log }
}

const cfg = JSON.parse(JSON.stringify(recordSheetConfigs.RD_INSP_PLAN))
const good = simulate(cfg)
console.log('原配置:', good.ok ? 'PASS(7 格铺满)' : 'FAIL ' + good.why)
for (const l of good.log) console.log('   ', l)

// 反证 1:删掉 版本号 的 rowspan:2 ⇒ 第 3 行应缺右端两格
const broken1 = JSON.parse(JSON.stringify(cfg))
delete broken1.sections[0].rows[1].pairs[2].rowspan
const r1 = simulate(broken1)
console.log('反证1(去掉 版本号 rowspan):', r1.ok ? '⚠ 仍然 PASS —— 模拟是空转,断言无效' : 'FAIL 如期 → ' + r1.why)

// 反证 2:把 产品编号 的值格 vspan 去掉 ⇒ 第 1 行少一格、后面全串位
const broken2 = JSON.parse(JSON.stringify(cfg))
delete broken2.sections[0].rows[0].pairs[0].vspan
const r2 = simulate(broken2)
console.log('反证2(去掉 产品编号 vspan):', r2.ok ? '⚠ 仍然 PASS —— 模拟是空转,断言无效' : 'FAIL 如期 → ' + r2.why)
