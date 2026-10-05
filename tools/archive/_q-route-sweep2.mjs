/**
 * _q-route-sweep2.mjs — 工艺路线/BOM 接口面二次穷举(2026-10-04,用户给出界面编号 GYLX / GX 之后)
 *
 * 目的:上一轮已试 66 条路径(全 519)。本轮补两类口子:
 *   ① 生产/制造家族的更多命名(work_order/process_route/routing/technics/craft…)
 *   ② 「轻智造云」这类生态应用是否在 /koas/{appId}/api 下发布(试已知的 KIS 应用号 + 常见号段),
 *      以及星辰侧是否有「应用/模块」枚举口子
 * 另外用界面上的编号(GYLX-0006/GX-0001)去各接口 search,看有没有任何口子能把它查回来。
 * 只读。用法:node tools/archive/_q-route-sweep2.mjs
 */
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'))
const { token } = await fetchAppToken(cfg.kingdee)
const G = (p, q) => kingdeeTryGet(cfg.kingdee, token, p, q)

const CODES = ['GYLX-0006', 'GYLX-0022', 'GX-0001']
const paths = [
  // 星辰:生产/制造家族
  '/jdy/v2/pm/routing', '/jdy/v2/pm/routings', '/jdy/v2/pm/process_routing', '/jdy/v2/pm/technics',
  '/jdy/v2/pm/craft', '/jdy/v2/pm/craft_route', '/jdy/v2/pm/work_route', '/jdy/v2/pm/procedure',
  '/jdy/v2/pm/procedures', '/jdy/v2/pm/operation', '/jdy/v2/pm/operations', '/jdy/v2/pm/work_center',
  '/jdy/v2/pm/workshop', '/jdy/v2/pm/team', '/jdy/v2/pm/shift', '/jdy/v2/pm/equipment',
  '/jdy/v2/bd/routing', '/jdy/v2/bd/process_routing', '/jdy/v2/bd/technics', '/jdy/v2/bd/craft',
  '/jdy/v2/bd/procedure', '/jdy/v2/bd/operation', '/jdy/v2/bd/work_center', '/jdy/v2/bd/team',
  // 单据家族里可能挂工艺路线的(生产任务单/工单)
  '/jdy/v2/pm/mo_taskbill', '/jdy/v2/pm/workorder', '/jdy/v2/pm/work_order',
  // 生态应用(koas)口子:已知 KIS 应用号 + 轻智造云可能号段
  '/koas/app007099/api/simulatedbom/list', '/koas/app007140/api/qualitycheck/list',
  '/koas/app007155/api/list', '/koas/app007720/api/list',
  '/jdy/v2/apps', '/jdy/v2/sys/apps', '/jdy/v2/sys/modules',
]
let okCount = 0
for (const p of paths) {
  const r = await G(p, { page: '1', page_size: '5', search: CODES[0] })
  if (r.ok) { okCount++; console.log(`  ✅ ${p.padEnd(44)} count=${r.data?.count} rows=${(r.data?.rows || []).length}`) }
  else console.log(`  ❌ ${p.padEnd(44)} ${String(r.error).slice(0, 46)}`)
}
console.log(`\n可用(ok=true)的路径 ${okCount}/${paths.length} 条`)

console.log('\n===== 用界面编号去「可用」的口子里搜,看能不能查回来 =====')
const searchable = ['/jdy/v2/bd/material', '/jdy/v2/bd/aux_info', '/jdy/v2/bd/dept', '/jdy/v2/bd/bom']
for (const code of CODES) {
  for (const p of searchable) {
    const r = await G(p, { page: '1', page_size: '3', search: code })
    if (!r.ok) continue
    if (Number(r.data?.count) > 0) console.log(`  ★ ${code} 在 ${p} 命中 count=${r.data.count}: ${JSON.stringify(r.data.rows?.[0]).slice(0, 200)}`)
    else console.log(`    ${code} 在 ${p} → 0 条`)
  }
}
