/**
 * _q-bom-route-live.mjs — 「界面上的 BOM单 / 工艺路线 能不能从金蝶拉」的终局判定探针(2026-10-04)
 *
 * 背景:用户从金蝶界面(轻智造云)截图举证 —— BOM单:产品编码 A-32-01、工艺路线 GYLX-0006;
 *   工艺路线:GYLX-0022「3支装一盒」明细 GX-0001 成型 / GX-0002 切炭 / GX-0003 组装装箱。
 * 上一轮核查的悬置点(见 deploy/工艺路线接口核查.md):账套里 bd/bom count=0、306 商品抽样全 0,
 *   当时请用户给一个 BOM 编号/产品编码做终局判定 —— 本探针就是用截图里的编码去实测。
 *
 * 判据:
 *   · /jdy/v2/bd/material?search=A-32-01  → 该产品在不在(拿 material_id)
 *   · /jdy/v2/bd/bom_query?material_id=   → 该产品挂了哪些 BOM 单(id/number)
 *   · /jdy/v2/bd/bom_detail?number=/id=   → 表头 + material_entity 子料分录
 *   · /jdy/v2/bd/bom(列表)              → 账套 BOM 单总数(复核 count)
 *   · 工艺路线:按 GYLX-0006/GYLX-0022 穷举接口面(bd/pm/koas…),看有没有能把编号查回来的口子
 * 只读,不改任何数据。用法:node tools/archive/_q-bom-route-live.mjs
 */
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet, kingdeePost } from '../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'))
const { token } = await fetchAppToken(cfg.kingdee)
const G = (p, q) => kingdeeTryGet(cfg.kingdee, token, p, q)
const P = (p, b) => kingdeePost(cfg.kingdee, token, p, {}, b)
const j = (v) => JSON.stringify(v)

console.log('===== ① 截图里的产品 A-32-01 在不在金蝶 =====')
let mat = null
for (const q of [{ search: 'A-32-01' }, { number: 'A-32-01' }, { search: 'A-32' }]) {
  const r = await G('/jdy/v2/bd/material', { page: '1', page_size: '20', ...q })
  if (!r.ok) { console.log(`  ${j(q)} → ❌ ${r.error}`); continue }
  const rows = r.data.rows || []
  console.log(`  ${j(q)} → count=${r.data.count} 返回 ${rows.length} 行`)
  const hit = rows.find((x) => String(x.number || '').trim() === 'A-32-01') || rows[0]
  if (hit) {
    mat = hit
    console.log(`     命中: number=${hit.number} name=${hit.name} id=${hit.id} model=${hit.model || '-'}`)
    if (String(hit.number).trim() === 'A-32-01') break
  }
}

if (mat) {
  console.log('\n===== ② 该产品挂的 BOM 单(/jdy/v2/bd/bom_query)=====')
  const bq = await G('/jdy/v2/bd/bom_query', { material_id: String(mat.id), page: '1', page_size: '20' })
  if (bq.ok) {
    console.log(`  count=${bq.data.count} rows=${(bq.data.rows || []).length}`)
    for (const r of (bq.data.rows || []).slice(0, 5)) console.log('   ', j(r).slice(0, 300))
    const first = (bq.data.rows || [])[0]
    if (first) {
      console.log('\n===== ③ BOM 详情(/jdy/v2/bd/bom_detail)=====')
      for (const key of ['number', 'id']) {
        const v = key === 'number' ? first.number : first.id
        if (!v) continue
        const d = await G('/jdy/v2/bd/bom_detail', { [key]: String(v) })
        if (!d.ok) { console.log(`  ${key}=${v} → ❌ ${d.error}`); continue }
        const h = d.data || {}
        console.log(`  ${key}=${v} → 表头键: ${Object.keys(h).join(', ')}`)
        console.log(`     number=${h.number} product=${h.product_number}/${h.product_name} 版本=${h.version} 成品率=${h.yield}`)
        const ent = h.material_entity || h.entries || []
        console.log(`     子料分录 ${ent.length} 行:`)
        for (const e of ent.slice(0, 8)) console.log('       ', j(e).slice(0, 240))
        break
      }
    }
  } else console.log(`  ❌ ${bq.error}`)

  console.log('\n===== ④ 生产管理版「根据产品查询BOM」(POST /jdy/v2/pm/bom)=====')
  const pm = await P('/jdy/v2/pm/bom', { material_ids: [{ material_id: String(mat.id) }] })
  console.log('  ok=' + pm.ok + ' ' + (pm.ok ? j(pm.data).slice(0, 400) : pm.error))
}

console.log('\n===== ⑤ BOM 单列表总数(复核账套 BOM 家底)=====')
const list = await G('/jdy/v2/bd/bom', { page: '1', page_size: '5' })
console.log('  ok=' + list.ok + ' ' + (list.ok ? `count=${list.data.count} rows=${(list.data.rows || []).length}` : list.error))
if (list.ok && (list.data.rows || []).length) {
  for (const r of list.data.rows.slice(0, 5)) console.log('   ', `number=${r.number} product=${r.product_number}/${r.product_name} 分录=${(r.material_entity || []).length}`)
}

console.log('\n===== ⑥ 工艺路线:按界面上的编号穷举接口面 =====')
const CODES = ['GYLX-0006', 'GYLX-0022', 'GX-0001', 'GX-0002', 'GX-0003']
const PATHS = [
  '/jdy/v2/pm/route', '/jdy/v2/pm/routing', '/jdy/v2/pm/process_route', '/jdy/v2/pm/process',
  '/jdy/v2/bd/route', '/jdy/v2/bd/routing', '/jdy/v2/bd/process_route', '/jdy/v2/bd/process',
  '/jdy/v2/pm/work_procedure', '/jdy/v2/bd/work_procedure',
]
for (const p of PATHS) {
  const r = await G(p, { page: '1', page_size: '5', search: CODES[0] })
  console.log(`  ${p.padEnd(34)} ${r.ok ? '✅ count=' + r.data.count : '❌ ' + String(r.error).slice(0, 60)}`)
}
// 通用搜索口子:看能不能用编号把工艺路线查回来
console.log('\n  按编号在常见"可搜索"基础资料接口里找工艺路线编号(GYLX-0006):')
for (const p of ['/jdy/v2/bd/material', '/jdy/v2/bd/aux_info', '/jdy/v2/sys/custom_field']) {
  const r = await G(p, { page: '1', page_size: '5', search: CODES[0] })
  console.log(`  ${p.padEnd(34)} ${r.ok ? 'count=' + r.data.count : '❌ ' + String(r.error).slice(0, 60)}`)
}
