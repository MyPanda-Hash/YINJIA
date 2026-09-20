/**
 * _probe-prodDocList.cjs — 产品文件列表(RD_PROD_DOCLIST)端点探针
 *
 * 用途:后端重启后验证新端点 /api/px/prodDocList 的真实返回,
 *      并断言"状态推导 + 是否受控 + 受控日期"三项派生逻辑正确。
 * 依赖:探针数据 tools/archive/_seed-prodDocList-test.sql(ZZTEST-1/2),跑完用 -cleanup 清理。
 *
 * 用法:node tools/archive/_probe-prodDocList.cjs
 */
'use strict'
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const USER = process.env.MES_USER || 'admin'
const PASS = process.env.MES_PASS || '123456'

let pass = 0
let fail = 0
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}${extra ? '  ' + extra : ''}`) }
}

async function main() {
  const lr = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: USER, password: PASS }),
  })
  const lj = await lr.json()
  if (lj.code !== 200) throw new Error('登录失败: ' + JSON.stringify(lj))
  const token = lj.data.token
  console.log(`登录成功(${USER})`)

  const r = await fetch(`${BASE}/api/px/prodDocList`, { headers: { Authorization: `Bearer ${token}` } })
  const j = await r.json()
  console.log(`\nGET /api/px/prodDocList → HTTP ${r.status}, code=${j.code}`)
  check('HTTP 200 且业务 code=200', r.status === 200 && j.code === 200)

  const cols = (j.data && j.data.columns) || []
  const rows = (j.data && j.data.rows) || []
  console.log(`列头(${cols.length}):${cols.map((c) => c.panelName + '[' + c.panelCode + ']').join(' | ')}`)
  check('列头 = 设计 4 个下游面板且顺序一致', JSON.stringify(cols.map((c) => c.panelName)) ===
    JSON.stringify(['成型工艺清单', '组装工艺清单', '规格书', '出货检验计划表']), JSON.stringify(cols.map((c) => c.panelName)))

  const r1 = rows.find((x) => x['产品编号'] === 'ZZTEST-1')
  const r2 = rows.find((x) => x['产品编号'] === 'ZZTEST-2')
  check('含探针产品 ZZTEST-1/ZZTEST-2(产品编号透传正常)', !!r1 && !!r2)
  if (!r1 || !r2) { console.log('\n!! 探针数据缺失,请先跑 _seed-prodDocList-test.sql'); process.exit(1) }

  console.log('\n-- ZZTEST-1(4 面板各一张已归档单)--')
  console.log('   cells =', JSON.stringify(r1.cells))
  console.log(`   是否受控=${JSON.stringify(r1['是否受控'])} 受控日期=${JSON.stringify(r1['受控日期'])} done=${r1.doneCount}/${r1.totalCount} overall=${r1.overall}`)
  check('4 格状态全部 = 开发完毕', Object.values(r1.cells).every((v) => v === '开发完毕'), JSON.stringify(r1.cells))
  check('doneCount = 4 / totalCount = 4', r1.doneCount === 4 && r1.totalCount === 4)
  check('overall = 开发完毕', r1.overall === '开发完毕')
  check('是否受控 = 是(4 份全归档)', r1['是否受控'] === '是', JSON.stringify(r1['是否受控']))
  check('受控日期 = 最晚归档时点 2026-09-20 10:15:00', String(r1['受控日期']).startsWith('2026-09-20 10:15:00'), String(r1['受控日期']))

  console.log('\n-- ZZTEST-2(仅成型一张草稿)--')
  console.log('   cells =', JSON.stringify(r2.cells))
  console.log(`   是否受控=${JSON.stringify(r2['是否受控'])} done=${r2.doneCount}/${r2.totalCount} overall=${r2.overall}`)
  check('成型工艺清单 = 开发中(有草稿)', r2.cells.RD_MOLD_PROC === '开发中', r2.cells.RD_MOLD_PROC)
  check('其余 3 格 = 未开发', ['RD_ASM_PROC', 'RD_SPEC_DOC', 'RD_INSP_PLAN'].every((p) => r2.cells[p] === '未开发'))
  check('doneCount = 0(未归档不计完成)', r2.doneCount === 0)
  check('overall = 开发中(有进行中)', r2.overall === '开发中')
  check('是否受控 = 否', r2['是否受控'] === '否', JSON.stringify(r2['是否受控']))
  check('受控日期为空(未受控)', !r2['受控日期'], JSON.stringify(r2['受控日期']))

  console.log(`\n结果:${pass} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
