/**
 * 只读探针 #2(2026-10-14):把「金蝶真实账套没有生产任务单」这个结论钉死,并看下游单据指向谁。
 *
 * 目的:
 *   ① mo_taskbill 在**加显式条件**下是否仍为 0(排除「默认参数把数据筛没了」的可能):
 *      试 bill_status=C / 宽 modify 时间窗 / 不限页大小 等组合。
 *   ② 生产领料单(inv_pick)、产品入库单(inv_product)的**来源单**字段(src_bill_type_id/
 *      src_bill_no/src_seq)指向哪类单据 —— 若指向生产任务单,则说明工单确实存在于星辰;
 *      若指向空或别的东西,则工单在**云蝶轻智造**那侧(与 BOM/工艺路线同一情形)。
 *
 * 只读(全部 GET),不写任何单据。用法:
 *   node tools/archive/_probe-kingdee-mo-taskbill2-1014.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const out = []
const say = (s) => { out.push(s); console.log(s) }

const { token } = await fetchAppToken(cfg)
say(`账套 clientId=${cfg.clientId} outerInstanceId=${cfg.outerInstanceId}  ✅ token 已取`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const now = Date.now()

say('\n=== ① mo_taskbill:各种参数组合下的 count ===')
const variants = [
  ['裸参数(仅分页)', { page: '1', page_size: '50' }],
  ['bill_status=C(已审核)', { bill_status: 'C', page: '1', page_size: '50' }],
  ['宽 modify 窗口(近 3 年)', { modify_start_time: String(now - 3 * 365 * 86400000), modify_end_time: String(now + 86400000), page: '1', page_size: '50' }],
  ['bill_status=C + 宽 modify 窗口', { bill_status: 'C', modify_start_time: String(now - 3 * 365 * 86400000), modify_end_time: String(now + 86400000), page: '1', page_size: '50' }],
  ['bill_status=A(全部/草稿?)', { bill_status: 'A', page: '1', page_size: '50' }],
  ['按取样产品 A-32-01 的 material_number 过滤', { material_number: 'A-32-01', page: '1', page_size: '50' }],
]
for (const [label, params] of variants) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/pm/mo_taskbill', params)
  say(`  ${label.padEnd(34)} → ${r.ok ? `count=${r.data?.count} rows=${(r.data?.rows || []).length}` : '❌ ' + String(r.error).slice(0, 110)}`)
  await sleep(250)
}

say('\n=== ② 下游单据:生产领料单 inv_pick / 产品入库单 inv_product(取 3 条看来源单)===')
for (const p of ['/jdy/v2/scm/inv_pick', '/jdy/v2/scm/inv_product']) {
  const r = await kingdeeTryGet(cfg, token, p, { bill_status: 'C', page: '1', page_size: '3' })
  say(`--- ${p} → count=${r.ok ? r.data?.count : '❌ ' + String(r.error).slice(0, 110)}`)
  const rows = (r.ok && r.data?.rows) || []
  if (rows[0]) {
    say(`  列表行字段: ${Object.keys(rows[0]).join(', ')}`)
    const want = ['bill_no', 'bill_date', 'bill_status', 'material_number', 'material_name',
      'src_bill_no', 'src_bill_type_id', 'src_bill_type_name', 'src_bill_type_number', 'src_seq', 'src_inter_id', 'src_entry_id',
      'dept_name', 'emp_name', 'stock_name', 'qty', 'remark']
    for (const row of rows) {
      const kv = want.filter((k) => row[k] !== undefined).map((k) => `${k}=${row[k]}`).join('  ')
      say(`  · ${kv}`)
    }
  } else {
    say('  (无行)')
  }
  // 详情:看行级 src_*
  if (rows[0]?.id) {
    const d = await kingdeeTryGet(cfg, token, p + '_detail', { id: String(rows[0].id) })
    if (d.ok) {
      const dd = d.data || {}
      const ents = dd.material_entity || dd.bill_entry || []
      say(`  详情顶层键: ${Object.keys(dd).slice(0, 25).join(', ')}`)
      say(`  分录数=${Array.isArray(ents) ? ents.length : '(非数组)'};分录字段: ${Array.isArray(ents) && ents[0] ? Object.keys(ents[0]).join(', ') : '(无)'}`)
      if (Array.isArray(ents) && ents[0]) {
        const e0 = ents[0]
        const sk = Object.keys(e0).filter((k) => /^src_|mo_|task|order/.test(k))
        say(`  分录里与来源/工单相关的键: ${sk.map((k) => `${k}=${e0[k]}`).join('  ') || '(无)'}`)
      }
    } else {
      say(`  ❌ 详情: ${String(d.error).slice(0, 130)}`)
    }
  }
  await sleep(300)
}

const f = new URL('./_probe-kingdee-mo-taskbill2-1014.out.txt', import.meta.url)
writeFileSync(f, out.join('\n') + '\n', 'utf8')
console.log('\n[产物已落盘] tools/archive/_probe-kingdee-mo-taskbill2-1014.out.txt')
