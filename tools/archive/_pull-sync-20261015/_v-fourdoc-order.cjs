/**
 * _v-fourdoc-order.cjs — 一次性取证:四单「基线快照 vs 现役库」到底差在哪
 *
 * 背景:拉取云端后 verify\FourDocAudit.java 报 182 处偏离(两账套一致),本次按文档 §8 重跑四步,
 *   本文档 diff 155+/157-。本脚本把差异**分类**,回答"是有意调序还是回归":
 *     A 字段集合差(多出/缺失)            —— 真的有字段被增删
 *     B 内容差(label/类型/参照/显示名…)   —— 字段定义被改
 *     C 显隐/可编辑位差(flags E/R/H/V)    —— hidden 被翻开这类
 *     D 纯名次差(同一批字段,只是顺序变)  —— 调序
 *   并打印每个面板「基线顺序」与「现役顺序」的对照,供人工判定。
 *
 * 用法(仓库根):node tools\archive\_pull-sync-20261015\_v-fourdoc-order.cjs
 * 只读:输入 = tools/fourdoc-baseline.tsv(基线) + tools/archive/_dump-out/fields-HSDZ_MES.md(现役 db dump)
 */
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..', '..', '..')
const tsvPath = path.join(root, 'tools', 'fourdoc-baseline.tsv')
const dumpPath = path.join(root, 'tools', 'archive', '_dump-out', 'fields-HSDZ_MES.md')

const PANELS = ['QC_RECV', 'QC_INSP', 'QC_RETURN', 'PURCHASE_IN']
const PLACES = ['query', 'header', 'detail']

// ---- 基线 TSV:ord panel col_name label place seq data_type width flags alias ref_panel ref_field display_field ref_filter dict_sql label_en col_group
const base = []
for (const ln of fs.readFileSync(tsvPath, 'utf8').split(/\r?\n/).slice(1)) {
  if (!ln.trim()) continue
  const t = ln.split('\t')
  base.push({
    panel: t[1], col: t[2], label: t[3], place: t[4], seq: +t[5], type: t[6],
    width: t[7], flags: t[8], alias: t[9], refPanel: t[10], refField: t[11],
    displayField: t[12], refFilter: t[13], dictSql: t[14], labelEn: t[15], colGroup: t[16],
  })
}

// ---- 现役 dump:place seq label col_name data_type width flags(E R H V) alias ref_panel ref_field display_field ref_filter dict_sql label_en col_group id
const have = []
let cur = null
for (const ln of fs.readFileSync(dumpPath, 'utf8').split(/\r?\n/)) {
  const m = ln.match(/^===== (\w+) =====$/)
  if (m) { cur = m[1]; continue }
  if (!ln.startsWith('FIELD\t') || !cur) continue
  const t = ln.split('\t')
  have.push({
    panel: cur, place: t[1], seq: +t[2], label: t[3], col: t[4], type: t[5], width: t[6],
    flags: t[7], alias: t[8], refPanel: t[9], refField: t[10], displayField: t[11],
    refFilter: t[12], dictSql: t[13], labelEn: t[14], colGroup: t[15], id: +t[16],
  })
}

const key = (r) => `${r.panel}|${r.place}|${r.col}|${r.label}`
const CONTENT = ['type', 'width', 'alias', 'refPanel', 'refField', 'displayField', 'refFilter', 'dictSql', 'labelEn', 'colGroup']
// 基线 flags 顺序 = E R H V(与 dump 的 editable/required/hidden/visible 拼法一致)
const FLAG_NAME = { 0: 'editable', 1: 'required', 2: 'hidden', 3: 'visible' }

let total = { A: 0, B: 0, C: 0, D: 0 }
for (const p of PANELS) {
  console.log(`\n================ ${p} ================`)
  for (const place of PLACES) {
    const w = base.filter((r) => r.panel === p && r.place.split(',').includes(place))
    const h = have.filter((r) => r.panel === p && r.place.split(',').includes(place))
    if (!w.length && !h.length) continue
    const wMap = new Map(), hMap = new Map()
    for (const r of w) wMap.set(key(r), r)
    for (const r of h) hMap.set(key(r), r)
    const extra = h.filter((r) => !wMap.has(key(r)))
    const missing = w.filter((r) => !hMap.has(key(r)))
    const contentDiff = [], flagDiff = []
    for (const r of h) {
      const b = wMap.get(key(r))
      if (!b) continue
      const c = CONTENT.filter((f) => String(b[f] ?? '') !== String(r[f] ?? ''))
      // flags:基线 "E--V" ↔ 现役同序 4 位
      if (b.flags !== r.flags) {
        const changed = [0, 1, 2, 3].filter((i) => b.flags[i] !== r.flags[i])
          .map((i) => `${FLAG_NAME[i]}: ${b.flags[i] === '-' ? '0' : '1'}→${r.flags[i] === '-' ? '0' : '1'}`)
        flagDiff.push(`${r.label}(${r.col}) [${changed.join(', ')}]`)
      }
      if (c.length) contentDiff.push(`${r.label}: ${c.map((f) => `${f} ${b[f]}→${r[f]}`).join('; ')}`)
    }
    // 名次:去掉增删后的公共键,各自按 seq,id 排序后的位置
    const common = h.filter((r) => wMap.has(key(r)))
    const wOrder = w.filter((r) => hMap.has(key(r))).slice().sort((a, b) => a.seq - b.seq)
    const hOrder = common.slice().sort((a, b) => a.seq - b.seq || a.id - b.id)
    const moved = []
    for (let i = 0; i < wOrder.length; i++) {
      if (key(wOrder[i]) !== key(hOrder[i])) moved.push(`${i + 1}: ${wOrder[i].label} → ${hOrder[i].label}`)
    }
    if (!extra.length && !missing.length && !contentDiff.length && !flagDiff.length && !moved.length) {
      console.log(`  [${place}] 一致 ✅`)
      continue
    }
    total.A += extra.length + missing.length
    total.B += contentDiff.length
    total.C += flagDiff.length
    total.D += moved.length
    console.log(`  [${place}] 现役 ${h.length} / 基线 ${w.length} | 多出 ${extra.length}·缺失 ${missing.length}·内容 ${contentDiff.length}·开关位 ${flagDiff.length}·名次 ${moved.length}`)
    if (extra.length) console.log('     + 多出: ' + extra.map((r) => `${r.label}@seq${r.seq}`).join('、'))
    if (missing.length) console.log('     - 缺失: ' + missing.map((r) => `${r.label}@seq${r.seq}`).join('、'))
    if (contentDiff.length) console.log('     ~ 内容: ' + contentDiff.slice(0, 8).join(' | '))
    if (flagDiff.length) console.log('     ! 开关: ' + flagDiff.slice(0, 12).join(' | ') + (flagDiff.length > 12 ? ` …共 ${flagDiff.length}` : ''))
    if (moved.length) {
      console.log('     ↕ 名次: ' + moved.slice(0, 10).join(' | ') + (moved.length > 10 ? ` …共 ${moved.length}` : ''))
      console.log('       基线顺序: ' + wOrder.map((r) => r.label).join(' › '))
      console.log('       现役顺序: ' + hOrder.map((r) => r.label).join(' › '))
    }
  }
}
console.log(`\n==== 汇总:字段增删 ${total.A} · 内容改 ${total.B} · 开关位改 ${total.C} · 纯名次改 ${total.D} ====`)
