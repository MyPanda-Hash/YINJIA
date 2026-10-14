/**
 * 探针 0b(只读,2026-10-14):沙箱账套「三类目标单据」现状侦察。
 *
 * 回答三个问题(全部 GET,不写单):
 *   ① 沙箱(outerInstanceId 579046204055359488)里 inv_product / inv_other_in / inv_other_out
 *      现分别有多少张单?有没有可参照的既有单据?
 *   ② 既有单据详情里的 **业务类型**(trans_type_id / trans_type_number / trans_type)、
 *      部门/职员/仓库都是什么值 —— 后面写保存探针要照抄沙箱自己的 id(★不能抄真实账套的 id,
 *      两个账套的 trans_type_id 不是一个体系;真实账套样例 12/13 在沙箱未必存在)。
 *   ③ 商品的批次属性(is_batch)与可用计量单位 —— 决定最小 body 要不要带 batch_no。
 *
 * 用法:  node tools/archive/_probe-kingdee-sandbox-recon-1014.mjs
 * 产物:  tools/archive/_dump-out/kingdee-sandbox-recon-1014.md(UTF-8)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT_DIR = path.join(ROOT, 'tools/archive/_dump-out')
const cfg = JSON.parse(readFileSync(path.join(ROOT, 'deploy/push/config.json'), 'utf8')).kingdee
if (cfg.outerInstanceId) throw new Error('push/config.json 里出现 outerInstanceId,疑似真实账套,已中止')
const OID = cfg.sandboxInstanceId
const authCfg = { ...cfg, outerInstanceId: OID }
const { token, domain } = await fetchAppToken(authCfg)

const lines = []
const say = (s) => { lines.push(s); console.log(s) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const get = (p, params) => kingdeeTryGet({ ...cfg, outerInstanceId: OID, domain }, token, p, params)

say('# 沙箱三类目标单据现状侦察(只读)')
say('')
say(`- 账套: 华实创新(惠州)科技有限公司 outerInstanceId=${OID}(clientId=${cfg.clientId})`)
say(`- 时间: ${new Date().toISOString()}`)
say('')

const TYPES = [
  ['产品入库单', '/jdy/v2/scm/inv_product'],
  ['其他入库单', '/jdy/v2/scm/inv_other_in'],
  ['其他出库单', '/jdy/v2/scm/inv_other_out'],
  ['生产领料单(对照)', '/jdy/v2/scm/inv_pick'],
  ['采购入库单(对照)', '/jdy/v2/scm/pur_inbound'],
]

say('## ① 单据数量 + 最近一张详情关键键')
say('')
for (const [label, p] of TYPES) {
  const r = await get(p, { page: '1', page_size: '3' })
  if (!r.ok) { say(`### ${label} \`${p}\` —— ❌ ${String(r.error).slice(0, 160)}`); say(''); await sleep(220); continue }
  const d = r.data || {}
  const rows = d.rows || []
  say(`### ${label} \`${p}\`(count=${d.count})`)
  say('')
  if (!rows.length) { say('(沙箱内无单据)'); say(''); await sleep(220); continue }
  say(`最近 ${rows.length} 张单号: ` + rows.map((x) => `${x.bill_no}(${x.bill_date},${x.bill_status})`).join(' / '))
  say('')
  const det = await get(p.replace(/^\/jdy\/v2\/scm\//, '/jdy/v2/scm/').replace(/^/, '') + '_detail', { id: String(rows[0].id) })
  if (!det.ok) { say(`详情 ❌ ${String(det.error).slice(0, 160)}`); say(''); await sleep(220); continue }
  const dd = det.data || {}
  const keys = Object.keys(dd)
  say(`详情顶层键 ${keys.length} 个;业务类型族 = ` +
    keys.filter((k) => /^trans_type/.test(k)).map((k) => `${k}=${JSON.stringify(dd[k])}`).join(' , '))
  say(`表头取样: dept_id=${dd.dept_id || '(空)'} emp_id=${dd.emp_id || '(空)'} bill_no=${dd.bill_no} bill_type_id=${dd.bill_type_id || '(无此键)'}`)
  say(`表头全键: ${keys.join(', ')}`)
  const ents = dd.material_entity || []
  if (ents[0]) {
    const e = ents[0]
    say('')
    say(`分录键 ${Object.keys(e).length} 个;首行关键值: material_id=${e.material_id} material_number=${e.material_number} stock_id=${e.stock_id}/${e.stock_number} unit_id=${e.unit_id} base_unit_id=${e.base_unit_id} qty=${e.qty} batch_no=${JSON.stringify(e.batch_no)} coefficient=${e.coefficient} material_is_batch=${e.material_is_batch}`)
  }
  say('')
  await sleep(250)
}

say('## ② 商品档案:批次/多单位/单位 明细采样')
say('')
const mats = await get('/jdy/v2/bd/material', { page: '1', page_size: '100' })
const mrows = mats.ok ? (mats.data?.rows || []) : []
say(`商品共 ${mats.data?.count} 个,本页 ${mrows.length} 个`)
say('')
say('| id | number | name | is_batch | is_multi_unit | base_unit_id/name | 其它单位 |')
say('|---|---|---|---|---|---|---|')
let shown = 0
for (const m of mrows) {
  showBlock: {
    if (shown >= 25) break showBlock
    const unitTxt = m.base_unit_id ? `${m.base_unit_id}/${m.base_unit_name || ''}` : '(无 base_unit_id 键)'
    const other = JSON.stringify(Object.keys(m).filter((k) => /unit/i.test(k)).map((k) => `${k}=${JSON.stringify(m[k])}`)).slice(0, 200)
    say(`| ${m.id} | ${m.number} | ${m.name} | ${m.is_batch} | ${m.is_multi_unit} | ${unitTxt} | ${other} |`)
    shown++
  }
}
say('')
say(`商品档案全键: ${mrows[0] ? Object.keys(mrows[0]).join(', ') : '(空)'}`)
say('')

say('## ③ 商品详情(取单个商品的单位/批次,确认可用 unit_id)')
say('')
for (const m of mrows.slice(0, 3)) {
  const r = await get('/jdy/v2/bd/material_detail', { id: String(m.id) })
  say(`### ${m.number} ${m.name} (id=${m.id})`)
  if (!r.ok) { say(`❌ ${String(r.error).slice(0, 160)}`); say(''); await sleep(220); continue }
  const d = r.data || {}
  say(`键: ${Object.keys(d).join(', ')}`)
  say(`is_batch=${d.is_batch} is_multi_unit=${d.is_multi_unit} base_unit_id=${d.base_unit_id} base_unit_name=${d.base_unit_name} sale_unit_id=${d.sale_unit_id} pur_unit_id=${d.pur_unit_id} stock_unit_id=${d.stock_unit_id}`)
  const units = d.material_unit_entity || d.unit_entity || d.material_multi_unit || null
  say(`多单位分录: ${units ? JSON.stringify(units).slice(0, 400) : '(无此键)'}`)
  say('')
  await sleep(220)
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(path.join(OUT_DIR, 'kingdee-sandbox-recon-1014.md'), lines.join('\n') + '\n', 'utf8')
console.log('\n[产物已落盘] tools/archive/_dump-out/kingdee-sandbox-recon-1014.md')
