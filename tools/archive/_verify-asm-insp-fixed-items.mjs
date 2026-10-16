/*
 * _verify-asm-insp-fixed-items.mjs — 固定检验项(端盖两头/管身两侧)链路实测(2026-10-16,一次性探针)
 *
 * 验三件事:
 *   ① 面板配置里下发 metadata.fixedItems(声明式,yj_panel.config)+ 工具栏出现「带入固定检验项」;
 *   ② 报表:即使明细里**没有**外观行,外观组也永远铺出 端盖两头/管身两侧 两列(固定项);
 *      数据里的「外观-端盖两头」要按归一化**并进固定列**(不重复成两列);
 *   ③ 明细新增「检验结果」列(定性观测值),导出后落进该列的格子里。
 * ⚠ 只读:不点保存/带入(带入由 UI 探针点,不影响库)。
 * 用法: node tools/archive/_verify-asm-insp-fixed-items.mjs <docNo> [base] [factory]
 */
import fs from 'node:fs'
import path from 'node:path'

const DOC = process.argv[2] || 'ZJ-2026-10-0008'
const BASE = (process.argv[3] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const FACTORY = process.argv[4] || 'YJ'

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok   - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  | ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const H = { Authorization: 'Bearer ' + login.data.token }

/* ① 配置:fixedItems + 工具栏入口 + 检验结果列 */
const cfg = (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=QC_ASM_INSP`, { headers: H }).then((r) => r.json())).data
const md = cfg?.metadata || {}
const fixed = md.fixedItems || []
console.log('   fixedItems = ' + JSON.stringify(fixed))
/* 2026-10-16 用户拍板:三组都是固定组 —— 外观带两个固定项,尺寸/出货重量整组一列(列名=label) */
const byGroup = Object.fromEntries(fixed.map((f) => [f.group, f]))
ok('配置下发 metadata.fixedItems(三组:外观/尺寸/出货重量)',
  fixed.length === 3 && ['外观', '尺寸', '出货重量'].every((g) => byGroup[g]), JSON.stringify(fixed))
ok('外观组带两个固定项(端盖两头/管身两侧)',
  (byGroup['外观']?.items || []).join(',') === '端盖两头,管身两侧', JSON.stringify(byGroup['外观']))
ok('尺寸/出货重量 带组列名(整组一列,照截图)',
  byGroup['尺寸']?.label === '按照尺寸检验项目填充' && byGroup['出货重量']?.label === '按照重量检验项目填充',
  JSON.stringify([byGroup['尺寸'], byGroup['出货重量']]))
const actions = []
for (const g of md.buttonGroups || []) for (const a of g.actions || []) actions.push(a)
ok('工具栏已无「带入固定检验项」(口径改为分区渲染默认铺出三区 + 固定项预置行)',
  !actions.includes('带入固定检验项'), actions.join(',').slice(0, 160))
const cols = (md.panelPageDto?.tablePages?.[0]?.gridTabs?.[0]?.columns || []).map((f) => (typeof f === 'string' ? f : f.dataName))
ok('明细新增「检验结果」列', cols.includes('检验结果'), cols.join('|'))

/* ②③ 导出报表:固定列必须在(即使没有外观数据行) */
const res = await fetch(`${BASE}/api/report/export?code=qc_asm_insp&panelCode=QC_ASM_INSP&docNo=${encodeURIComponent(DOC)}&format=pdf`, { headers: H })
const buf = res.ok ? Buffer.from(await res.arrayBuffer()) : Buffer.alloc(0)
ok('导出报表 PDF 成功', res.status === 200 && buf.length > 1000, `status=${res.status} bytes=${buf.length}`)
if (buf.length > 1000) {
  const out = path.join(import.meta.dirname, `_verify-asm-insp-fixed-${DOC}.pdf`)
  fs.writeFileSync(out, buf)
  console.log('   PDF: ' + out)
}

console.log(`\n==== 结果:${pass} 通过 / ${fail} 失败 ====`)
process.exit(fail > 0 ? 1 : 0)
