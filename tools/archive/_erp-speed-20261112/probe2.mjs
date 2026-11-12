/**
 * 只读探针2(2026-11-12):pur_inbound / sal_out_bound 的列表接口到底认哪些**过滤参数**?
 * 目的:转ERP 重复入库的最强闸 = "推之前先问金蝶:这张 MES 单是不是已经在了"。
 *   已知 outside_pk_id 过滤无效(见 probe.mjs [D]);这里再逐个试 search / keyword / remark / bill_no。
 * 判定口径:过滤后返回的行里,**每一行**都必须匹配该过滤值,否则视为"这个参数不生效"。
 * ⚠ 只发 GET,不写金蝶任何单据。
 */
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'

const k = JSON.parse(readFileSync(new URL('../../../deploy/push/config.json', import.meta.url), 'utf8')).kingdee
const cfg = { ...k, outerInstanceId: (k.outerInstanceId || k.sandboxInstanceId || '').trim() }
const { token, domain } = await fetchAppToken(cfg)
const c = { ...cfg, domain }

async function rows(path, params) {
  const r = await kingdeeTryGet(c, token, path, { page: '1', page_size: '50', ...params })
  if (!r.ok) return { err: r.error, rows: [] }
  return { rows: r.data.rows || [] }
}

for (const path of ['/jdy/v2/scm/pur_inbound', '/jdy/v2/scm/sal_out_bound']) {
  console.log(`\n=== ${path} ===`)
  const base = await rows(path, {})
  const sample = base.rows[0] || {}
  const billNo = String(sample.bill_no || '').trim()
  console.log(`样单 bill_no=${billNo}  remark=${JSON.stringify(String(sample.remark || '').slice(0, 50))}`)
  const mesNo = (/\[MES:([^\]]+)\]/.exec(String(sample.remark || '')) || [])[1] || ''
  console.log(`样本返回 ${base.rows.length} 行;remark 里的 MES 单号 = ${mesNo || '(无)'}`)
  for (const [label, params, expect] of [
    ['bill_no', { bill_no: billNo }, (r) => String(r.bill_no).trim() === billNo],
    ['search=bill_no', { search: billNo }, (r) => String(r.bill_no).trim() === billNo],
    ['keyword=bill_no', { keyword: billNo }, (r) => String(r.bill_no).trim() === billNo],
    ['search=MES:单号', mesNo ? { search: `MES:${mesNo}` } : null, (r) => String(r.remark || '').includes(mesNo)],
    ['remark=含MES单号', mesNo ? { remark: `[MES:${mesNo}]` } : null, (r) => String(r.remark || '').includes(mesNo)],
    ['bill_no=不存在的号', { bill_no: 'ZZZ-NOT-EXIST-9999' }, (r) => String(r.bill_no).trim() === 'ZZZ-NOT-EXIST-9999'],
  ]) {
    if (!params) continue
    const got = await rows(path, params)
    if (got.err) { console.log(`  ${label.padEnd(22)} ERR ${got.err}`); continue }
    const hit = got.rows.filter(expect).length
    const verdict = got.rows.length === 0 ? '过滤生效(0 行)' : hit === got.rows.length ? '过滤生效(全部匹配)' : `**不生效**(返回 ${got.rows.length} 行,只有 ${hit} 行匹配)`
    console.log(`  ${label.padEnd(22)} → ${got.rows.length} 行;${verdict}`)
  }
}
