/**
 * 只读探针(2026-10-14):银嘉真实账套的四类单据有没有数据 + 成品入库单有没有「全检/抽检」字段。
 *
 * 用户问:采购入库单 / 材料出库单 / 成品入库单(后面要检验,看有没有全检、抽检字段)/ 销售出库单,
 *         是不是都有数据。
 *
 * 口径对齐(与 MES 现有转ERP 通道一致,见 backend KingdeePushService):
 *   采购入库单(MES PURCHASE_IN) → 星辰 /jdy/v2/scm/pur_inbound
 *   材料出库单(MES MATERIAL_OUT)→ 星辰 /jdy/v2/scm/inv_pick(星辰叫「生产领料单」)
 *   成品入库单(MES FINISH_IN  ) → 星辰 /jdy/v2/scm/inv_product(星辰叫「产品入库单」)  ← 本探针重点找检验字段
 *   销售出库单(MES SALE_OUT  ) → 星辰 /jdy/v2/scm/sal_out_bound
 *   旁证:其他出库 /jdy/v2/scm/inv_other_out
 *
 * 「全检/抽检」找法(不猜中文,直接扫接口返回的**全部键**,含详情与自定义字段容器):
 *   ① 键名命中 /check|inspect|qc|quality|test|way|type/ ⇒ 逐个打印键与值
 *   ② 商品档案 /jdy/v2/bd/material 的 check_type(是否检验)分布 ⇒ 检验配置挂在哪一级
 *   ③ 候选「检验单」接口探测(/jdy/v2/qc/* 等)⇒ 星辰是否把检验单也开放出来
 *
 * 只读(全部 GET),不写任何单据。用法:
 *   node tools/archive/_probe-kingdee-4docs-1014.mjs
 * 产物: tools/archive/_probe-kingdee-4docs-1014.out.txt(UTF-8,完整字段)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const out = []
const say = (s) => { out.push(s); console.log(s) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const { token } = await fetchAppToken(cfg)
say('=== 银嘉真实账套:四类单据数据 + 成品入库单检验字段(只读)===')
say(`账套: 惠州市银嘉环保科技有限公司 clientId=${cfg.clientId} outerInstanceId=${cfg.outerInstanceId}`)
say(`时间: ${new Date().toISOString()}\n`)

const DOCS = [
  ['采购入库单', '/jdy/v2/scm/pur_inbound'],
  ['材料出库单→星辰「生产领料单」', '/jdy/v2/scm/inv_pick'],
  ['成品入库单→星辰「产品入库单」', '/jdy/v2/scm/inv_product'],
  ['销售出库单', '/jdy/v2/scm/sal_out_bound'],
  ['旁证:其他出库单', '/jdy/v2/scm/inv_other_out'],
]

say('=== ① 四类单据计数 + 最近 3 张 + 列表行字段 ===')
const fields = {}
for (const [label, path] of DOCS) {
  const r = await kingdeeTryGet(cfg, token, path, { bill_status: 'C', page: '1', page_size: '3' })
  if (!r.ok) { say(`\n--- ${label}  ${path}\n    ❌ ${String(r.error).slice(0, 140)}`); await sleep(250); continue }
  const rows = r.data?.rows || []
  say(`\n--- ${label}  ${path}`)
  say(`    count = ${r.data?.count}`)
  if (rows[0]) {
    fields[path] = Object.keys(rows[0])
    say(`    列表行字段(${fields[path].length}): ${fields[path].join(', ')}`)
    for (const row of rows) {
      const pick = ['bill_no', 'bill_date', 'bill_status', 'supplier_name', 'customer_name', 'dept_name', 'emp_name', 'stock_name', 'remark']
      say('    · ' + pick.filter((k) => row[k] !== undefined).map((k) => `${k}=${row[k]}`).join('  '))
    }
  } else say('    (无行)')
  await sleep(250)
}
say(`\n  四类单据计数小结: ${DOCS.map(([l, p]) => `${l.split('→')[0]}=${fields[p] ? '有' : '?'}`).join('  ')}`)

say('\n=== ② 成品入库单 inv_product:详情全字段 + 检验相关键 ===')
const ipList = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/inv_product', { bill_status: 'C', page: '1', page_size: '1' })
const ipRow = (ipList.ok && ipList.data?.rows || [])[0]
if (ipRow) {
  say(`取单: ${ipRow.bill_no} (${ipRow.bill_date})  id=${ipRow.id}`)
  const d = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/inv_product_detail', { id: String(ipRow.id) })
  if (d.ok) {
    const dd = d.data || {}
    const topKeys = Object.keys(dd)
    say(`\n[表头顶层键 ${topKeys.length}] ${topKeys.join(', ')}`)
    say(`\n[表头完整 JSON(截断长值)]\n${JSON.stringify(dd, (k, v) => (typeof v === 'string' && v.length > 120 ? v.slice(0, 120) + '…' : v), 1).slice(0, 4000)}`)
    const ents = dd.material_entity || dd.bill_entry || []
    if (Array.isArray(ents) && ents[0]) {
      const entKeys = Object.keys(ents[0])
      say(`\n[分录 ${ents.length} 行,分录键 ${entKeys.length}] ${entKeys.join(', ')}`)
      say(`\n[第一条分录完整 JSON]\n${JSON.stringify(ents[0], (k, v) => (typeof v === 'string' && v.length > 120 ? v.slice(0, 120) + '…' : v), 1).slice(0, 4000)}`)
      // 嵌套容器也列一下键
      for (const k of Object.keys(ents[0])) {
        const v = ents[0][k]
        if (Array.isArray(v) && v[0] && typeof v[0] === 'object') say(`   嵌套数组 ${k}: ${v.length} 项,键 = ${Object.keys(v[0]).join(', ')}`)
        else if (v && typeof v === 'object') say(`   嵌套对象 ${k}: 键 = ${Object.keys(v).join(', ')}`)
      }
    }
    // 检验相关键扫描(表头 + 分录 + 嵌套)
    const SCAN = /check|inspect|qc|quality|test|way|assay|sample|full/i
    const hits = []
    const walk = (obj, prefix) => {
      if (!obj || typeof obj !== 'object') return
      for (const k of Object.keys(obj)) {
        const v = obj[k]
        if (SCAN.test(k)) hits.push(`${prefix}${k} = ${JSON.stringify(v)?.slice(0, 100)}`)
        if (v && typeof v === 'object') walk(v, `${prefix}${k}.`)
      }
    }
    walk(dd, '')
    say(`\n[检验相关键扫描 check|inspect|qc|quality|test|way|assay|sample|full]`)
    say(hits.length ? hits.map((h) => '   · ' + h).join('\n') : '   (无命中)')
  } else say(`❌ 详情失败: ${String(d.error).slice(0, 160)}`)
}

say('\n=== ③ 商品档案的检验配置(check_type 分布)===' )
let pageNo = 1, dist = {}, sample = []
while (pageNo <= 4) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/bd/material', { page: String(pageNo), page_size: '200' })
  if (!r.ok) { say(`  ❌ 第${pageNo}页: ${String(r.error).slice(0, 120)}`); break }
  const rows = r.data?.rows || []
  for (const m of rows) {
    const k = `check_type=${JSON.stringify(m.check_type)}`
    dist[k] = (dist[k] || 0) + 1
    if (sample.length < 5 && String(m.check_type) === '1') sample.push(`${m.number} / ${m.name} / check_type=${m.check_type}`)
  }
  if (rows.length < 200) break
  pageNo++
  await sleep(250)
}
say('  样本(前 800 个商品)check_type 分布: ' + Object.entries(dist).map(([k, v]) => `${k}: ${v}`).join('  '))
say('  check_type=1 的样例: ' + (sample.join(' | ') || '(无)'))

say('\n=== ④ 星辰是否开放「检验单」类接口(候选路径探测)===' )
for (const p of ['/jdy/v2/qc/qc_bill', '/jdy/v2/qc/inspect', '/jdy/v2/pm/qc_bill', '/jdy/v2/scm/inv_check_bill', '/jdy/v2/qc/qc_inspect_bill', '/jdy/v2/pm/inspect_bill']) {
  const r = await kingdeeTryGet(cfg, token, p, { page: '1', page_size: '1' })
  say(`  ${p.padEnd(32)} ${r.ok ? '✅ count=' + r.data.count : '❌ ' + String(r.error).slice(0, 70)}`)
  await sleep(220)
}

const f = new URL('./_probe-kingdee-4docs-1014.out.txt', import.meta.url)
writeFileSync(f, out.join('\n') + '\n', 'utf8')
console.log('\n[产物已落盘] tools/archive/_probe-kingdee-4docs-1014.out.txt')
