/**
 * 只读探针(2026-11-12「转ERP 反应慢 + 双击重复入库」排查):
 *   ① 量化「转ERP」冷启动各步的耗时(取 token / 商品·仓库·职员·部门·单位档案分页 / 源单解析);
 *   ② 验证 pur_inbound 列表能否按 outside_pk_id / remark 反查「这张 MES 单是否已在金蝶」——
 *      这是"重复入库"最强的一道闸(推送前先查金蝶,已存在就不推)。
 *
 * ⚠ 全程只用 GET / 列表类接口,**不写金蝶任何单据**。凭证取 deploy/push/config.json(本地=沙箱)。
 * 用法:node tools/archive/_erp-speed-20261112/probe.mjs
 */
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'

const k = JSON.parse(readFileSync(new URL('../../../deploy/push/config.json', import.meta.url), 'utf8')).kingdee
// 与后端 dynamicInstanceId() 同映射:真实账套优先,否则沙箱走动态授权(两者都按 24h 轮换取新密钥)
const cfg = { ...k, outerInstanceId: (k.outerInstanceId || k.sandboxInstanceId || '').trim() }

const ms = (t0) => `${Date.now() - t0}ms`
async function timed(label, fn) {
  const t0 = Date.now()
  try {
    const r = await fn()
    console.log(`  ${label.padEnd(46)} ${ms(t0)}`)
    return r
  } catch (e) {
    console.log(`  ${label.padEnd(46)} ${ms(t0)}  ERR ${e.message}`)
    return null
  }
}

console.log('账套 =', cfg.outerInstanceId ? '真实账套' : `沙箱(${cfg.sandboxInstanceId || '静态密钥'})`)

let token, domain
const tToken = Date.now()
;({ token, domain } = await fetchAppToken(cfg))
console.log(`\n[A] 取 app-token: ${ms(tToken)}(每个进程只取一次,缓存 22h)`)

const paths = {
  商品: '/jdy/v2/bd/material',
  仓库: '/jdy/v2/bd/store',
  职员: '/jdy/v2/bd/emp',
  部门: '/jdy/v2/bd/department',
  计量单位: '/jdy/v2/bd/measure_unit',
}

console.log('\n[B] 档案分页拉取的耗时(转ERP 冷启动必须全量灌进内存缓存的那几张表)')
for (const [label, path] of Object.entries(paths)) {
  const t0 = Date.now()
  let pages = 0
  let total = 0
  let lastRows = 0
  for (let page = 1; page <= 30; page++) {
    const r = await kingdeeTryGet({ ...cfg, domain }, token, path, { page: String(page), page_size: '200' })
    pages++
    if (!r.ok) { console.log(`  ${label} 第${page}页失败:${r.error}`); break }
    const rows = (r.data && r.data.rows) || []
    lastRows = rows.length
    total += rows.length
    if (rows.length < 200) break
  }
  console.log(`  ${label.padEnd(10)} ${String(pages).padStart(2)} 页 / ${String(total).padStart(5)} 条  ${ms(t0)}`)
}

console.log('\n[C] 采购订单源单解析(转ERP 挂 src_inter_id/src_entry_id 那两步)')
const t1 = Date.now()
const poList = await kingdeeTryGet({ ...cfg, domain }, token, '/jdy/v2/scm/pur_order', { page: '1', page_size: '10' })
const poNo = (poList.ok && poList.data && (poList.data.rows || [])[0] && poList.data.rows[0].bill_no) || ''
const poId = (poList.ok && poList.data && (poList.data.rows || [])[0] && poList.data.rows[0].id) || ''
console.log(`  采购订单列表(账套里最近一张=${poNo || '(无)'})        ${ms(t1)}`)
if (poNo) await timed(`  采购订单列表精确过滤 bill_no=${poNo}`, () => kingdeeTryGet({ ...cfg, domain }, token, '/jdy/v2/scm/pur_order', { page: '1', page_size: '10', bill_no: poNo }))
if (poId) await timed('  采购订单明细(pur_order_detail)', () => kingdeeTryGet({ ...cfg, domain }, token, '/jdy/v2/scm/pur_order_detail', { id: poId }))

console.log('\n[D] 去重可行性:pur_inbound 列表能否反查"这张 MES 单是否已在金蝶"')
const inbound = await timed('  pur_inbound 列表(不带过滤)', () => kingdeeTryGet({ ...cfg, domain }, token, '/jdy/v2/scm/pur_inbound', { page: '1', page_size: '10' }))
if (inbound?.ok) {
  const sample = (inbound.data.rows || [])[0] || {}
  console.log('    → 返回字段(前 40 个):', Object.keys(sample).slice(0, 40).join(','))
  console.log('    → outside_pk_id 示例 =', JSON.stringify(sample.outside_pk_id), ' remark 示例 =', JSON.stringify(String(sample.remark || '').slice(0, 40)))
  const probeVal = String(sample.outside_pk_id || 'NOPE-NOT-EXIST').trim()
  if (probeVal) {
    const q = await timed(`  按 outside_pk_id=${probeVal} 过滤`, () => kingdeeTryGet({ ...cfg, domain }, token, '/jdy/v2/scm/pur_inbound', { page: '1', page_size: '10', outside_pk_id: probeVal }))
    if (q?.ok) {
      const rows = q.data.rows || []
      console.log(`    → 命中 ${rows.length} 行;该过滤${rows.length === 1 && String(rows[0].outside_pk_id).trim() === probeVal ? '【有效】' : '【无效:返回未过滤的结果】'}`)
    }
  }
  // 备注里我们恒写 " [MES:单号]" —— 看看 remark 过滤能不能用
  const remarkSample = String(sample.remark || '')
  const m = /\[MES:([^\]]+)\]/.exec(remarkSample)
  if (m) {
    const q2 = await timed(`  按 remark 包含 MES:${m[1]} 过滤`, () => kingdeeTryGet({ ...cfg, domain }, token, '/jdy/v2/scm/pur_inbound', { page: '1', page_size: '10', remark: `[MES:${m[1]}]` }))
    if (q2?.ok) console.log(`    → 命中 ${(q2.data.rows || []).length} 行`)
  }
}

console.log('\n[D2] 同族:sal_out_bound / inv_other_in / inv_product / inv_pick / pur_ret 是否带回 outside_pk_id 字段')
for (const p of ['/jdy/v2/scm/sal_out_bound', '/jdy/v2/scm/inv_other_in', '/jdy/v2/scm/inv_product', '/jdy/v2/scm/inv_pick', '/jdy/v2/scm/pur_ret']) {
  const r = await kingdeeTryGet({ ...cfg, domain }, token, p, { page: '1', page_size: '1' })
  if (!r.ok) { console.log(`  ${p.padEnd(34)} ERR ${r.error}`); continue }
  const row = (r.data.rows || [])[0] || {}
  console.log(`  ${p.padEnd(34)} 有 outside_pk_id=${'outside_pk_id' in row}  有 remark=${'remark' in row}`)
}
