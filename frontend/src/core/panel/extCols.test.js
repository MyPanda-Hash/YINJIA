/**
 * extCols.test.js — 自定义列并入纸面列定义（纯函数）
 * 口径见 extCols.js 头注；用例直接对应 2026-11-11 用户要求：
 * 「测试数据字段要能新增列…最多 8 个…列还可以设计分叉…可以自己新建一个分组」。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { readFileSync } from 'node:fs'
import { mergeExtCols, pickExtFields, EXT_COL_DEFAULT_W } from './extCols.js'

const BASE_COLS = [
  { key: '测试时间', label: '测试时间' },
  { key: '水温（℃）', label: '水温（℃）' },
]
const BASE_SUB = [{ label: '口感测试', span: 2 }]

test('① 没有自定义列时原样返回（零波及既有 8 张表）', () => {
  const r = mergeExtCols({ cols: BASE_COLS, subHeads: BASE_SUB, detailFields: [] })
  assert.deepEqual(r.cols, BASE_COLS)
  assert.deepEqual(r.subHeads, BASE_SUB)
  assert.equal(r.addedCount, 0)
})

test('② 自定义列追加到末尾，沿用元数据列宽；缺省宽兜底', () => {
  const r = mergeExtCols({
    cols: BASE_COLS, subHeads: BASE_SUB,
    detailFields: [
      { dataName: '自定义A', place: 'detail', width: 150 },
      { dataName: '自定义B', place: 'detail' },
    ],
  })
  assert.equal(r.cols.length, 4)
  assert.deepEqual(r.cols.slice(2).map((c) => c.key), ['自定义A', '自定义B'])
  assert.equal(r.cols[2].w, 150)
  assert.equal(r.cols[3].w, EXT_COL_DEFAULT_W)
  assert.equal(r.addedCount, 2)
})

test('③ 带 colGroup 的自定义列 → 分叉表头多一格（自己新建分组）', () => {
  const r = mergeExtCols({
    cols: BASE_COLS, subHeads: BASE_SUB,
    detailFields: [{ dataName: '浊度', place: 'detail', colGroup: '新增分析' }],
  })
  assert.deepEqual(r.subHeads, [
    { label: '口感测试', span: 2 },
    { label: '新增分析', span: 1 },
  ])
})

test('④ 同分组的相邻自定义列合并成一格（选同一个已有分组名时不会出现两个同名格）', () => {
  const r = mergeExtCols({
    cols: BASE_COLS, subHeads: BASE_SUB,
    detailFields: [
      { dataName: '钠2', place: 'detail', colGroup: '新增分析' },
      { dataName: '镁2', place: 'detail', colGroup: '新增分析' },
    ],
  })
  assert.deepEqual(r.subHeads, [
    { label: '口感测试', span: 2 },
    { label: '新增分析', span: 2 },
  ])
})

test('⑤ 原表本来没有分叉、但自定义列要分组 ⇒ 补一格覆盖原有列的占位（否则表头短一截对不齐）', () => {
  const r = mergeExtCols({
    cols: BASE_COLS, subHeads: [],
    detailFields: [{ dataName: '浊度', place: 'detail', colGroup: '新增分析' }],
  })
  assert.deepEqual(r.subHeads, [
    { label: '', span: 2 },      // 原有两列
    { label: '新增分析', span: 1 },
  ])
  // span 合计必须等于可见列数，否则 spreadSubHeads 会被截断
  assert.equal(r.subHeads.reduce((s, x) => s + x.span, 0), r.cols.length)
})

test('⑥ 原表没有分叉、自定义列也不分组 ⇒ 保持单行表头（不硬造分叉行）', () => {
  const r = mergeExtCols({
    cols: BASE_COLS, subHeads: [],
    detailFields: [{ dataName: '浊度', place: 'detail' }],
  })
  assert.deepEqual(r.subHeads, [])
  assert.equal(r.cols.length, 3)
})

test('⑦ 已经在静态列里的字段不重复追加；hidden / 非明细字段跳过', () => {
  const r = mergeExtCols({
    cols: BASE_COLS, subHeads: BASE_SUB,
    detailFields: [
      { dataName: '测试时间', place: 'detail' },     // 已在静态列
      { dataName: '隐藏列', place: 'detail', hidden: true },
      { dataName: '表头字段', place: 'header' },
      { dataName: '真新列', place: 'detail' },
    ],
  })
  assert.deepEqual(r.addedLabels, ['真新列'])
  assert.equal(r.cols.length, 3)
})

test('⑧ 不修改入参（免得住进 store 的配置被就地改坏）', () => {
  const cols = BASE_COLS.map((c) => ({ ...c }))
  const subs = BASE_SUB.map((s) => ({ ...s }))
  const colsCopy = JSON.parse(JSON.stringify(cols))
  const subsCopy = JSON.parse(JSON.stringify(subs))
  mergeExtCols({ cols, subHeads: subs, detailFields: [{ dataName: 'X', place: 'detail', colGroup: 'G' }] })
  assert.deepEqual(cols, colsCopy)
  assert.deepEqual(subs, subsCopy)
})

/* ── 手写纸面（功能性滤效 DataRecordSheet）共用同一口径 ─────────────────── */
test('⑨ pickExtFields：只挑不在既有列集里的字段（配置驱动与手写纸面共用）', () => {
  const known = new Set(['冲水时间', '测试时间'])
  const got = pickExtFields([
    { dataName: '冲水时间', place: 'detail' },
    { dataName: '浊度NTU', place: 'detail', width: 110, colGroup: '新增分析' },
    { dataName: '隐藏的', place: 'detail', hidden: true },
    { dataName: '表头的', place: 'header' },
  ], known)
  assert.deepEqual(got.map((x) => x.key), ['浊度NTU'])
  assert.equal(got[0].w, 110)
  assert.equal(got[0]._group, '新增分析')
})

test('⑩ 功能性滤效纸面必须把「流速」也算作既有列，否则会凭空多出一排列', () => {
  // 实测事故：压力/流速 是**同一个格子**里的两个键，而 DT_COLUMNS 只登记了压力
  //   ⇒ 若只按 DT_COLUMNS 判"既有"，流速（L/min)样品N 会被当成自定义列渲染成 6 个空列。
  const sheet = readFileSync(new URL('../views/DataRecordSheet.vue', import.meta.url), 'utf8')
  assert.match(sheet, /extKnownKeys/, '缺少既有列集 extKnownKeys')
  assert.match(sheet, /流速（L\/min\)样品\$\{n\}/, '必须把 流速（L/min)样品N 加进既有列集')
  // 三处渲染都要有自定义列循环（colgroup / 表头两行 / 表体）
  assert.match(sheet, /v-for="\(e, ei\) in extCols"[\s\S]{0,80}<col/, 'colgroup 要追加自定义列')
  assert.match(sheet, /v-for="\(h, hi\) in extHeadCells"/, '表头第一行要渲染自定义列（分组占 colspan，无分组占 rowspan=2）')
  assert.match(sheet, /v-for="\(e, ei\) in extSubCols"/, '表头第二行要渲染分组子列')
  assert.match(sheet, /row\[e\.key\]/, '表体要按数据键绑定自定义列的值')
})

test('⑪ 新增列不能把表撑出纸宽：整表等比压缩，总宽回到设计宽', () => {
  // 用户口径（2026-11-11）：「新增的会超出对应的行宽，应该改为自适应压缩前面的行宽」。
  // 实测：原实现把自定义列追加在**固定总宽之外**，加 1 列即溢出纸面。
  const sheet = readFileSync(new URL('../views/DataRecordSheet.vue', import.meta.url), 'utf8')
  assert.match(sheet, /DT_BASE_TOTAL\s*=\s*1176/, '缺少表格设计总宽常量')
  assert.match(sheet, /const dtScale = computed/, '缺少压缩系数')
  assert.match(sheet, /DT_BASE_TOTAL \/ all/, '压缩系数应按 设计总宽÷实际总宽 计算')
  // 既有固定列必须走 dtW()（否则仍是写死像素，压不动）
  assert.match(sheet, /dtW\(130, 84\)/, '「冲水时间」列宽要走 dtW 压缩')
  assert.match(sheet, /dtW\(96, 66\)/, '「累计进水/原水含量」列宽要走 dtW 压缩')
  // 自定义列也要参与压缩，不能固定用配置宽
  assert.match(sheet, /extColW\(e\)/, '自定义列的 col 宽必须走 extColW（参与压缩）')
  // 样品组列宽乘压缩系数
  assert.match(sheet, /220 \* dtScale\.value/, '压力组列宽要乘压缩系数')
  assert.match(sheet, /192 \* dtScale\.value/, '出水/去除率组列宽要乘压缩系数')
})

test('⑫ 配置驱动表的 colgroup 必须带 span，且加列后整表回到纸宽', () => {
  // 用户口径（2026-11-11）：「这个面板（抑菌）会出现这种情况，新增一个列字段之后」——版面被压窄。
  // 根因两条：① `样品信息` 这类 span:3 的列只生成了 1 个不带 span 的 <col>，
  //            表头 colspan=3 与下面格子对不上、总宽也和纸宽对不上；
  //          ② 列宽是逐列固定像素，累加本来就不等于纸宽，再加一列就彻底错位。
  const sheet = readFileSync(new URL('../views/RecordSheetPanels.vue', import.meta.url), 'utf8')
  assert.match(sheet, /:span="\(c\.span \|\| 1\) > 1 \? c\.span : undefined"/, '<col> 必须带 span（多变列列才能对齐）')
  assert.match(sheet, /function dtFillK\(dt\)/, '缺少"加列后填充纸宽"的缩放函数')
  const m = sheet.match(/function dtFillK\(dt\)[\s\S]*?\n\}/)
  assert.ok(m, 'dtFillK 实现缺失')
  assert.match(m[0], /addedCount/, '没加过列的表必须返回 1（既有版面零影响）')
  assert.match(m[0], /gridW\.value \/ want/, '应按 纸宽÷各列(含span)宽度和 缩放')
})

test('⑬ 表外元素（「＋ 新增数据记录行」条）必须与表格同宽', () => {
  // 用户口径（2026-11-11）：「这个也要对齐」——截图里表格 898px、加行条只有 720px。
  // 根因：加行条宽度用 dtW(dt)=Σ(c.w||100)，漏了 ①span:3 列按 3 份算 ②有自定义列时按 dtFillK 缩放到纸宽。
  const sheet = readFileSync(new URL('../views/RecordSheetPanels.vue', import.meta.url), 'utf8')
  assert.match(sheet, /function dtColSum\(dt\)/, '缺少含 span 的列宽求和')
  assert.match(sheet, /function dtTableW\(dt\)/, '缺少"表格实际渲染宽度"函数')
  const m = sheet.match(/function dtTableW\(dt\)[\s\S]*?\n\}/)
  assert.ok(m, 'dtTableW 实现缺失')
  assert.match(m[0], /designK\(dt\) : dtFillK\(dt\)/, 'dtTableW 要与 colgroup 同一口径（design / dtFillK）')
  // 加行条宽度必须走 dtTableW
  const addLine = sheet.split('\n').find((l) => l.includes('新增数据记录行') && l.includes('class="rs-add"'))
  assert.ok(addLine, '找不到加行条那一行')
  assert.match(addLine, /dtTableW\(dt\)/, '加行条宽度必须用 dtTableW（否则与表格不同宽）')
  assert.ok(!/dt\.design \? dtW\(dt\) \* designK\(dt\) : dtW\(dt\)/.test(addLine), '不得再退回旧的 dtW 写法')
})

test('⑭ 同格版式的编号选择框要收短到「下方信息块」的宽度', () => {
  // 用户口径（2026-11-11）：「选择框应该收短与下边平齐，所以的都是」。
  // 原来 `.rs-onecell > .rs-ref-ctl { flex: 1 1 auto }` 会把整格剩余宽度吃满，
  // 选择框左缘压到「密级/适用范围」那一块的中段，与下面逐行不齐。
  const sheet = readFileSync(new URL('../views/RecordSheetPanels.vue', import.meta.url), 'utf8')
  assert.match(sheet, /const oneCellDocnoW = computed/, '缺少 oneCellDocnoW 计算')
  const m = sheet.match(/const oneCellDocnoW = computed\(\(\) => \{[\s\S]*?\n\}\)/)
  assert.ok(m, 'oneCellDocnoW 实现缺失')
  const b = m[0]
  assert.match(b, /infoLabel/, '宽度要含 infoLabel 那几列')
  assert.match(b, /infoValue/, '宽度要含 infoValue 那几列')
  assert.match(b, /cols\.slice\(Math\.max\(0, cols\.length - right\)\)/, '要取**末尾**那几列（右对齐）')
  // 模板挂 CSS 变量 + CSS 用固定宽
  assert.match(sheet, /'--docno-w': oneCellDocnoW \+ 'px'/, '模板要把宽度作为 --docno-w 挂上')
  assert.match(sheet, /flex: 0 0 var\(--docno-w, auto\)/, '同格编号控件要改用固定宽，不再 flex:1 1 auto')
})
