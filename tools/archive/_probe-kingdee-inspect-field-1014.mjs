/**
 * 只读探针(2026-10-14):星辰里「全检/抽检」到底挂在哪一级?
 *
 * 用户问:成品入库单后面要检验,金蝶里有没有「全检 / 抽检」这个字段。
 * 上一支探针(_probe-kingdee-4docs-1014)已证:产品入库单(inv_product)表头 31 键 + 分录 78 键,
 *   键名扫描 check|inspect|qc|… **零命中**;本支继续把范围放全:
 *   ① 商品档案 /jdy/v2/bd/material_detail 的**全部键** —— 星辰把检验配置挂在商品上(同步代码里
 *      check_type 就是「是否检验」),看它有没有「检验方式=全检/抽检/免检」这类字段;
 *   ② **值扫描**:不只扫键名,连值里出现「检验/全检/抽检/免检」的都抓出来(有些字段叫 remark/自定义);
 *   ③ 产品入库单详情里 custom_field / custom_entity_field 是否为空(空了就说明没被自定义字段承载);
 *   ④ 星辰「检验单」类接口是否开放(注意:scm/inv_check_bill 是**盘点单**,别当成检验单)。
 *
 * 只读(全部 GET),不写任何单据。用法:
 *   node tools/archive/_probe-kingdee-inspect-field-1014.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const out = []
const say = (s) => { out.push(s); console.log(s) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const { token } = await fetchAppToken(cfg)

const KEY_RE = /check|inspect|qc|quality|test|way|assay|sample|full/i
const VAL_RE = /检验|全检|抽检|免检|质检/

/** 深度遍历:键命中 KEY_RE 或 值命中 VAL_RE(中文)的条目全抓出来 */
function scan(obj, label) {
  const hits = []
  const walk = (o, path) => {
    if (o === null || o === undefined) return
    if (typeof o !== 'object') {
      const s = String(o)
      if (VAL_RE.test(s)) hits.push(`[值命中] ${label}${path} = ${s.slice(0, 90)}`)
      return
    }
    for (const k of Object.keys(o)) {
      const v = o[k]
      if (KEY_RE.test(k)) hits.push(`[键命中] ${label}${path}${k} = ${JSON.stringify(v)?.slice(0, 90)}`)
      walk(v, `${path}${k}.`)
    }
  }
  walk(obj, '')
  return hits
}

say('=== 星辰「全检/抽检」字段定位探针(只读)===')
say(`账套: 惠州市银嘉环保科技有限公司 outerInstanceId=${cfg.outerInstanceId}`)
say(`时间: ${new Date().toISOString()}\n`)

// ── ① 商品档案:两个取样商品(成品 A-32-01 / 一个原料),打全部键 ──────────────
const ids = [
  ['成品 A-32-01', '2182903026698778624'],
]
say('=== ① 商品档案 material_detail 全字段 + 检验相关扫描 ===')
for (const [label, id] of ids) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/bd/material_detail', { id })
  if (!r.ok) { say(`\n--- ${label} ❌ ${String(r.error).slice(0, 140)}`); continue }
  const d = r.data || {}
  const keys = Object.keys(d)
  say(`\n--- ${label} (${d.number} / ${d.name}) 顶层键 ${keys.length} 个:`)
  say('    ' + keys.join(', '))
  say(`    check_type = ${JSON.stringify(d.check_type)}`)
  const hits = scan(d, '')
  say(`\n    键/值扫描命中(${hits.length}):`)
  say(hits.length ? hits.map((h) => '      ' + h).join('\n') : '      (无)')
  // 嵌套数组也列出键名
  for (const k of keys) {
    const v = d[k]
    if (Array.isArray(v) && v[0] && typeof v[0] === 'object') say(`    嵌套数组 ${k}: ${v.length} 项,键 = ${Object.keys(v[0]).join(', ')}`)
  }
  await sleep(250)
}

// ── ② 产品入库单:值扫描 + 自定义字段容器是否为空 ──────────────────────────
say('\n=== ② 产品入库单 inv_product 详情:值扫描 + 自定义字段容器 ===')
const list = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/inv_product', { bill_status: 'C', page: '1', page_size: '1' })
const row = (list.ok && list.data?.rows || [])[0]
if (row) {
  const dd = (await kingdeeTryGet(cfg, token, '/jdy/v2/scm/inv_product_detail', { id: String(row.id) })).data || {}
  const hits = scan(dd, '')
  say(`单据 ${dd.bill_no}  键/值扫描命中(${hits.length}):`)
  say(hits.length ? hits.map((h) => '   ' + h).join('\n') : '   (无)')
  say(`  custom_field        = ${JSON.stringify(dd.custom_field)}`)
  const e0 = (dd.material_entity || [])[0] || {}
  say(`  custom_entity_field = ${JSON.stringify(e0.custom_entity_field)}`)
  say(`  分录里全部键(确认没有质检族): ${Object.keys(e0).filter((k) => KEY_RE.test(k)).join(', ') || '(无)'}`)
} else say('  (取不到单据)')

// ── ③ 「检验单」接口面:把盘点单排除掉 ─────────────────────────────────────
say('\n=== ③ 检验单类接口探测(注意 inv_check_bill 是**盘点单**,不是检验单)===')
for (const [p, note] of [
  ['/jdy/v2/scm/inv_check_bill', '已登记 = 盘点单(不是检验单)'],
  ['/jdy/v2/qc/qc_bill', '猜测'],
  ['/jdy/v2/pm/inspect', '猜测'],
  ['/jdy/v2/scm/inv_inspect', '猜测'],
  ['/jdy/v2/bd/inspect_item', '猜测'],
]) {
  const r = await kingdeeTryGet(cfg, token, p, { page: '1', page_size: '1' })
  say(`  ${p.padEnd(30)} ${r.ok ? '✅ count=' + r.data.count : '❌ ' + String(r.error).slice(0, 60)}   ${note}`)
  await sleep(220)
}

const f = new URL('./_probe-kingdee-inspect-field-1014.out.txt', import.meta.url)
writeFileSync(f, out.join('\n') + '\n', 'utf8')
console.log('\n[产物已落盘] tools/archive/_probe-kingdee-inspect-field-1014.out.txt')
