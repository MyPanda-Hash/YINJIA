/**
 * 只读探针(2026-10-15):金蝶云·星辰(惠州市银嘉环保 真实账套)**有没有半成品的出入库数据**。
 *
 * 用户问:「查看一下金蝶有没有半成品的出入库数据」。
 *
 * 做法(全程只读 GET,不写任何单据、不写库):
 *   ① 商品分类 /jdy/v2/bd/material_group → 金蝶侧到底有没有「半成品」这个分类;
 *   ② 商品档案 /jdy/v2/bd/material(全量分页)→ 按 group_name 分布,并列出**名称含「半成品」**的条目
 *      ⇒ 半成品候选集合 = { 分类名含半成品 } ∪ { 商品名含半成品 };
 *   ③ 逐类出入库单(采购入库/采购退货/销售出库/销售退货/生产领料/产品入库/其他入·出库/调拨/盘点/组装/委外)
 *      取列表 count + 最近若干张单据的**明细分录**,统计分录里的商品编码命中半成品候选集合的行数,
 *      并列出命中样本(单号/日期/商品/数量/仓库/批号);
 *   ④ 现存量接口探测:半成品候选在金蝶库存里有没有余额(旁证)。
 *
 * 用法: node tools/archive/_probe-kingdee-semi-1015.mjs [--sample 20]
 * 产物: tools/archive/_probe-kingdee-semi-1015.out.txt
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const SAMPLE = Number(process.argv[process.argv.indexOf('--sample') + 1]) || 20

const out = []
const say = (s) => { out.push(s); console.log(s) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const { token } = await fetchAppToken(cfg)
say('=== 金蝶云·星辰 真实账套:有没有「半成品」的出入库数据(只读)===')
say(`账套: 惠州市银嘉环保科技有限公司 clientId=${cfg.clientId} outerInstanceId=${cfg.outerInstanceId}`)
say(`时间: ${new Date().toISOString()}  抽样张数/单据类型: ${SAMPLE}`)

// ───────────────────────── ① 商品分类 ─────────────────────────
say('\n=== ① 商品分类档案 /jdy/v2/bd/material_group ===')
const grpRes = await kingdeeTryGet(cfg, token, '/jdy/v2/bd/material_group', { page: '1', page_size: '200' })
const groups = (grpRes.ok && (grpRes.data?.rows || [])) || []
if (!grpRes.ok) say(`  ❌ ${String(grpRes.error).slice(0, 140)}`)
else {
  say(`  count = ${grpRes.data?.count};首页 ${groups.length} 行`)
  for (const g of groups) say(`   · ${g.number || '(无编码)'} | ${g.name} | parent=${g.parent_name || g.parent_number || ''}`)
}
const grpSemi = groups.filter((g) => /半成品|半制品|在制品|WIP/i.test(String(g.name || '')))
say(`  ⇒ 分类名含「半成品/半制品/在制品」的: ${grpSemi.length ? grpSemi.map((g) => g.name).join('、') : '(无)'}`)
await sleep(250)

// ───────────────────────── ② 商品档案 ─────────────────────────
say('\n=== ② 商品档案 /jdy/v2/bd/material 全量:按分类分布 + 名称含「半成品」的条目 ===')
const mats = []
for (let p = 1; p <= 40; p++) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/bd/material', { page: String(p), page_size: '200' })
  if (!r.ok) { say(`  ❌ 第 ${p} 页: ${String(r.error).slice(0, 120)}`); break }
  const rows = r.data?.rows || []
  for (const m of rows) mats.push(m)
  if (rows.length < 200) break
  await sleep(200)
}
say(`  商品总数 = ${mats.length}`)
if (mats[0]) say(`  商品行字段(${Object.keys(mats[0]).length}): ${Object.keys(mats[0]).join(', ')}`)

const byGroup = new Map()
for (const m of mats) {
  const k = String(m.group_name || '(无分类)')
  byGroup.set(k, (byGroup.get(k) || 0) + 1)
}
say('  分类分布:')
for (const [k, v] of [...byGroup.entries()].sort((a, b) => b[1] - a[1])) say(`   · ${k} = ${v}`)

const semiMats = mats.filter((m) => /半成品|半制品|在制品/i.test(String(m.name || '')) || /半成品|半制品|在制品/i.test(String(m.group_name || '')))
say(`\n  ⇒ 半成品候选(判据: 分类名 or 商品名含「半成品/半制品/在制品」)共 ${semiMats.length} 条`)
for (const m of semiMats.slice(0, 80)) say(`   · ${m.number} | ${m.name} | 分类=${m.group_name || '(无)'} | 规格=${m.model || m.specification || ''} | 单位=${m.base_unit_name || m.unit_name || ''}`)
if (semiMats.length > 80) say(`   …(余 ${semiMats.length - 80} 条略)`)
const semiSet = new Set(semiMats.map((m) => String(m.number || '').trim()).filter(Boolean))
const semiNameById = new Map(semiMats.map((m) => [String(m.id || ''), `${m.number} ${m.name}`]))

// 名称含「半成品」但分类不是半成品的,单独提示(判据敏感性)
const nameOnly = mats.filter((m) => /半成品|半制品|在制品/i.test(String(m.name || '')) && !/半成品|半制品|在制品/i.test(String(m.group_name || '')))
say(`  判据敏感性:名称含半成品但分类不是半成品的 ${nameOnly.length} 条(已计入候选)`)

// ───────────────────────── ③ 出入库单据 ─────────────────────────
const DOCS = [
  ['采购入库单', '/jdy/v2/scm/pur_inbound'],
  ['采购退货单', '/jdy/v2/scm/pur_ret'],
  ['销售出库单', '/jdy/v2/scm/sal_out_bound'],
  ['销售退货单', '/jdy/v2/scm/sal_in_bound'],
  ['生产领料单(材料出库)', '/jdy/v2/scm/inv_pick'],
  ['产品入库单(成品入库)', '/jdy/v2/scm/inv_product'],
  ['其他入库单', '/jdy/v2/scm/inv_other_in'],
  ['其他出库单', '/jdy/v2/scm/inv_other_out'],
  ['调拨出库单', '/jdy/v2/scm/inv_tfout'],
  ['调拨入库单(候选路径)', '/jdy/v2/scm/inv_tfin'],
  ['盘点单', '/jdy/v2/scm/inv_check_bill'],
  ['组装单', '/jdy/v2/scm/inv_assemble'],
  ['拆卸单(候选路径)', '/jdy/v2/scm/inv_disassemble'],
  ['委外加工单', '/jdy/v2/pm/subm_workorder'],
]

const ENTRY_KEYS = ['material_entity', 'bill_entry', 'entries', 'entry', 'material_entity_list']
const pickEntries = (d) => {
  for (const k of ENTRY_KEYS) if (Array.isArray(d?.[k]) && d[k].length) return { key: k, rows: d[k] }
  // 兜底:第一个「元素是对象且含 material 相关键」的数组
  for (const k of Object.keys(d || {})) {
    const v = d[k]
    if (Array.isArray(v) && v[0] && typeof v[0] === 'object' && Object.keys(v[0]).some((x) => /material/i.test(x))) return { key: k, rows: v }
  }
  return { key: null, rows: [] }
}

say('\n=== ③ 逐类出入库单:总数 + 最近单据明细里的半成品分录 ===')
const summary = []
for (const [label, path] of DOCS) {
  const listRes = await kingdeeTryGet(cfg, token, path, { bill_status: 'C', page: '1', page_size: String(SAMPLE) })
  if (!listRes.ok) { say(`\n--- ${label}  ${path}\n    ❌ 接口不可用: ${String(listRes.error).slice(0, 110)}`); summary.push({ label, path, ok: false }); await sleep(220); continue }
  const rows = listRes.data?.rows || []
  const total = listRes.data?.count
  say(`\n--- ${label}  ${path}`)
  say(`    已审核单据总数 = ${total};本次抽最近 ${rows.length} 张明细`)
  let hitLines = 0, billHits = 0, detailOk = 0, lineTotal = 0
  const samples = []
  let entryKeySeen = null, lineKeys = null
  for (const b of rows) {
    const d = await kingdeeTryGet(cfg, token, `${path}_detail`, { id: String(b.id) })
    if (!d.ok) { say(`    · 详情失败 ${b.bill_no}: ${String(d.error).slice(0, 90)}`); await sleep(200); continue }
    detailOk++
    const { key, rows: ents } = pickEntries(d.data)
    entryKeySeen = key || entryKeySeen
    if (ents[0] && !lineKeys) lineKeys = Object.keys(ents[0])
    lineTotal += ents.length
    let thisBillHit = 0
    for (const e of ents) {
      const num = String(e.material_number || e.number || '').trim()
      const name = String(e.material_name || e.name || '')
      const inSemi = semiSet.has(num) || /半成品|半制品|在制品/i.test(name)
      if (inSemi) {
        hitLines++; thisBillHit++
        if (samples.length < 12) samples.push(`${b.bill_no}(${b.bill_date}) ${num} ${name} 数量=${e.qty ?? e.actual_qty ?? ''} 仓库=${e.stock_name || ''} 批号=${e.batch_no || ''}`)
      }
    }
    if (thisBillHit) billHits++
    await sleep(160)
  }
  say(`    分录容器键 = ${entryKeySeen || '(未识别)'};分录字段(${lineKeys?.length ?? 0}) ${lineKeys ? lineKeys.slice(0, 30).join(', ') : ''}`)
  say(`    抽到明细 ${detailOk}/${rows.length} 张,分录 ${lineTotal} 行;**命中半成品的分录 = ${hitLines} 行,涉及单据 = ${billHits} 张**`)
  if (samples.length) { say('    命中样本:'); for (const s of samples) say(`      · ${s}`) }
  summary.push({ label, path, ok: true, total, sampled: detailOk, lineTotal, hitLines, billHits })
  await sleep(220)
}

// ───────────────────────── ④ 现存量 ─────────────────────────
say('\n=== ④ 现存量/库存查询接口:半成品候选有没有余额 ===')
for (const [label, p] of [['库存查询(IMS)', '/jdy/v2/inv/inv_inventory_ims'], ['商品库存(scm)', '/jdy/v2/scm/inventory'], ['商品库存(inv)', '/jdy/v2/inv/inventory']]) {
  const r = await kingdeeTryGet(cfg, token, p, { page: '1', page_size: '5' })
  if (!r.ok) { say(`  ❌ ${label} ${p} → ${String(r.error).slice(0, 100)}`); await sleep(220); continue }
  const rows = r.data?.rows || r.data?.list || []
  say(`  ✅ ${label} ${p}  count=${r.data?.count}  行字段(${rows[0] ? Object.keys(rows[0]).length : 0}): ${rows[0] ? Object.keys(rows[0]).join(', ') : ''}`)
  if (rows[0]) say(`     首行样例: ${JSON.stringify(rows[0]).slice(0, 600)}`)
  await sleep(220)
}

// ───────────────────────── ⑤ 小结 ─────────────────────────
say('\n=== ⑤ 小结(证据在上一节逐条)===')
say(`  金蝶商品分类里含「半成品」的分类: ${grpSemi.length ? grpSemi.map((g) => `${g.number} ${g.name}`).join('、') : '无'}`)
say(`  半成品候选商品 ${semiMats.length} 条`)
for (const s of summary) {
  say(`  · ${s.label}: ${s.ok ? `总数 ${s.total},抽 ${s.sampled} 张/${s.lineTotal} 行,半成品分录 ${s.hitLines} 行(${s.billHits} 张)` : '接口不可用'}`)
}

writeFileSync(new URL('./_probe-kingdee-semi-1015.out.txt', import.meta.url), out.join('\n') + '\n', 'utf8')
console.log('\n[产物已落盘] tools/archive/_probe-kingdee-semi-1015.out.txt')
