/**
 * 只读探针3(2026-11-12):`search=` 到底搜哪些字段?能不能用 **MES 单号** 反查"这张单是否已在金蝶"?
 * 已知(search=MES:xxx 命中 0 行,bill_no 精确过滤有效)。这里试:纯 MES 单号、MES 单号片段、
 * 以及 remark 里的其它片段,看 search 覆盖 remark 还是只覆盖单据编号。
 * ⚠ 只发 GET。
 */
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'

const k = JSON.parse(readFileSync(new URL('../../../deploy/push/config.json', import.meta.url), 'utf8')).kingdee
const cfg = { ...k, outerInstanceId: (k.outerInstanceId || k.sandboxInstanceId || '').trim() }
const { token, domain } = await fetchAppToken(cfg)
const c = { ...cfg, domain }
const rows = async (path, params) => {
  const r = await kingdeeTryGet(c, token, path, { page: '1', page_size: '50', ...params })
  return r.ok ? (r.data.rows || []) : { err: r.error }
}

const path = '/jdy/v2/scm/pur_inbound'
const all = await rows(path, {})
const sample = all.find((r) => /\[MES:/.test(String(r.remark || ''))) || {}
const mesNo = (/\[MES:([^\]]+)\]/.exec(String(sample.remark || '')) || [])[1] || ''
console.log(`样单 bill_no=${sample.bill_no}  remark=${JSON.stringify(sample.remark)}  MES单号=${mesNo}`)

const tried = [
  ['search=纯MES单号', mesNo],
  ['search=MES单号后6位', mesNo.slice(-6)],
  ['search=单据编号后6位', String(sample.bill_no || '').slice(-6)],
]
for (const [label, val] of tried) {
  if (!val) continue
  const got = await rows(path, { search: val })
  if (got.err) { console.log(`  ${label.padEnd(24)} ERR ${got.err}`); continue }
  const byRemark = got.filter((r) => String(r.remark || '').includes(mesNo)).length
  console.log(`  ${label.padEnd(24)} value=${val} → ${got.length} 行;其中 remark 命中 = ${byRemark};bill_no 命中 = ${got.filter((r) => String(r.bill_no || '').includes(val)).length}`)
  got.slice(0, 3).forEach((r) => console.log(`      · ${r.bill_no}  ${JSON.stringify(String(r.remark || ''))}`))
}
