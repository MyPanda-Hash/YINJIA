/**
 * 只读探针(2026-10-15):金蝶**每个仓库里装的是什么品类** —— 找出"相当于半成品库"的仓库。
 *
 * 做法:/jdy/v2/bd/material 建 编码→分类(parent_name) 映射;
 *      /jdy/v2/scm/inventory 全量(每页 100)取 仓库×商品×数量,按 仓库×分类 汇总;
 *      再单列 YJ-08 车间仓 / CP-0x 成品仓 / YJ-0x 仓 的半成品行。
 *
 * 只读。用法: node tools/archive/_probe-kingdee-wh-category-1015.mjs
 * 产物: tools/archive/_probe-kingdee-wh-category-1015.out.txt
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const out = []
const say = (s) => { out.push(s); console.log(s) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const { token: t } = { token }

// ① 商品 → 分类
const cat = new Map()
let mCount = 0
for (let p = 1; p <= 45; p++) {
  const r = await kingdeeTryGet(cfg, t, '/jdy/v2/bd/material', { page: String(p), page_size: '200' })
  if (!r.ok) break
  const rows = r.data?.rows || []
  for (const m of rows) { cat.set(String(m.number || '').trim(), String(m.parent_name || '(无分类)')); mCount++ }
  if (rows.length < 200) break
  await sleep(140)
}
say(`① 商品 ${mCount} 条,建立 编码→分类 映射 ${cat.size} 条`)

// ② 商品库存全量
const wh = new Map()   // 仓库 -> { byCat: Map, rows }
const semiRows = []
let n = 0
for (let p = 1; p <= 80; p++) {
  const r = await kingdeeTryGet(cfg, t, '/jdy/v2/scm/inventory', { page: String(p), page_size: '100' })
  if (!r.ok) { say(`  第${p}页失败 ${String(r.error).slice(0, 80)}`); break }
  const rows = r.data?.rows || []
  for (const x of rows) {
    n++
    const k = `${x.stock_number}/${x.stock_name}`
    if (!wh.has(k)) wh.set(k, { rows: 0, byCat: new Map(), qtyByCat: new Map() })
    const w = wh.get(k)
    const c = cat.get(String(x.material_number || '').trim()) || '(不在档案)'
    w.rows++; w.byCat.set(c, (w.byCat.get(c) || 0) + 1)
    w.qtyByCat.set(c, (w.qtyByCat.get(c) || 0) + Number(x.qty || 0))
    if (c === '半成品') semiRows.push({ wh: k, ...x })
  }
  if (rows.length < 100) break
  await sleep(150)
}
say(`② 商品库存扫描 ${n} 行,覆盖仓库 ${wh.size} 个`)

say('\n=== ③ 各仓库的品类构成(按 商品分类 计数/数量)===')
for (const [k, w] of [...wh.entries()].sort((a, b) => b[1].rows - a[1].rows)) {
  const top = [...w.byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
  say(`\n--- ${k}  (库存行 ${w.rows})`)
  for (const [c, cnt] of top) say(`      · ${c}: ${cnt} 行 / 数量 ${w.qtyByCat.get(c)}`)
  if (w.byCat.size > 12) say(`      …另有 ${w.byCat.size - 12} 个分类`)
  const semiCnt = w.byCat.get('半成品') || 0
  say(`      ⇒ 半成品 ${semiCnt} 行${semiCnt ? '(本仓是半成品实际存放点)' : ''}`)
}

say(`\n=== ④ 商品库存里分类=半成品 的行(${semiRows.length})===`)
for (const x of semiRows) say(`   · ${x.wh} | ${x.material_number} ${x.material_name} | 仓位 ${x.sp_number || '-'}/${x.sp_name || '-'} | qty=${x.qty} 可用=${x.valid_qty}`)

const semiWh = [...wh.entries()].filter(([, w]) => (w.byCat.get('半成品') || 0) > 0).map(([k]) => k)
say(`\n=== ⑤ 小结 ===`)
say(`  · 有半成品库存的仓库: ${semiWh.length ? semiWh.join('、') : '无'}`)
const workshop = [...wh.entries()].filter(([k]) => /车间|YJ-08/.test(k))
say(`  · 「车间仓 YJ-08」的构成: ${workshop.length ? [...workshop[0][1].byCat.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => `${c}(${v}行)`).join('、') : '商品库存里没有该仓的行'}`)

writeFileSync(new URL('./_probe-kingdee-wh-category-1015.out.txt', import.meta.url), out.join('\n') + '\n', 'utf8')
console.log('\n[产物] tools/archive/_probe-kingdee-wh-category-1015.out.txt')
