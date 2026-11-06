/**
 * spikeWaterTemplate.test.js —— 加标水「表格模版」的纯逻辑（2026-11-06 用户口径）
 *
 * 【用户口径（第三轮）】
 *   「研发管理下单加标水这个面板，在标准库里面加上一个可以编辑模版的功能，现在的不行，
 *    可以让客户在页面进行一个模版自己设计，然后存进标准库里面，因为有很多种项目需要很多种表格，
 *    但是又不能一个一个写进去，只能是让客户自己能够操作去编辑模版，
 *    去查看品质管理里面的来料检验要求，这个里面有类似的操作，去参照然后设计一下」
 *
 * 判据不是"能拼出 JSON"，而是三条**会真的弄坏数据**的事：
 *   ① 新模版一建出来就必须**每列都能存值**（列 key 必须是已登记的明细字段，
 *      或者是同一保存动作里新建的自定义字段）——上一版让用户改「列名」顺手改了 key，
 *      列名一改，值就落在一个不存在的字段上，静默丢数据；
 *   ② 两列绑同一个字段 / 同名显示 ⇒ 互相覆盖，必须拦下；
 *   ③ 结构存进标准库 content 后必须能被 parseLayout 原样读回（写坏一个逗号整张单会退回内置列）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_COLS, TEMPLATE_COLS, PREFERRED_KEYS,
  baseTemplateCols, blankCols, nextFreeField, appendColumn,
  validateTemplate, layoutContent, summarizeTemplate,
} from './spikeWaterTemplate.js'
import { parseLayout } from './spikeWaterLayout.js'
import { recordSheetConfigs } from '../views/recordSheetConfigs.js'

/** 面板明细字段池（照 /px/getPanelConfig 下发的 data.detail.tabs[0].fields 形状） */
const POOL = [
  { label: '测试日期', dataType: '日期', width: 90 },
  { label: '项目名称', dataType: '文本', width: 110 },
  { label: '测试装置', dataType: '文本', width: 100 },
  { label: '测试工位', dataType: '文本', width: 90 },
  { label: '配水量\\n（L）', dataType: '文本', width: 80 },
  { label: '配置用水', dataType: '文本', width: 90 },
  { label: '硫酸镁', dataType: '文本', width: 90 },
  { label: '负责人', dataType: '文本', width: 70 },
]

test('上限口径：新建模版 6 列、新建/加列最多 15 列（用户明确要求）', () => {
  assert.equal(TEMPLATE_COLS, 6)
  assert.equal(MAX_COLS, 15)
})

test('首选 6 列必须与真实配置里的键逐字一致（配水量那个键含字面量反斜杠+n）', () => {
  // 配置里的老表就是这套键；写成 '\n'（换行）会拼出一个不存在的字段，值静默丢掉。
  const lead = recordSheetConfigs.RD_SPIKE_WATER.variants['除铅'].cols
  for (const key of PREFERRED_KEYS) {
    assert.ok(lead.some((c) => c.key === key), `首选列「${JSON.stringify(key)}」在除铅表里找不到,键写错了`)
  }
})

test('新模版默认 6 列：取首选字段、宽度/类型沿用字段元数据、无分格占两行', () => {
  const cols = baseTemplateCols(POOL)
  assert.equal(cols.length, TEMPLATE_COLS)
  assert.deepEqual(cols.map((c) => c.key), PREFERRED_KEYS)
  assert.equal(cols[0].w, 90)
  assert.equal(cols[0].rowspan, 2)
  assert.equal(cols[4].w, 80, '配水量的列宽要沿用字段宽度')
  assert.ok(cols.every((c) => c.key === c.label), '新模版列名默认=字段名,用户再改')
  assert.ok(cols.every((c) => !c.group), '新模版不分格')
})

test('字段池缺首选列时用剩下的字段补齐，仍保证 6 列都绑在已登记字段上', () => {
  const pool = POOL.filter((f) => f.label !== '测试日期' && f.label !== '测试工位')
  const cols = baseTemplateCols(pool)
  assert.equal(cols.length, 6)
  for (const c of cols) assert.ok(pool.some((f) => f.label === c.key), `「${c.key}」没绑到真实字段`)
  assert.ok(!cols.some((c) => c.key === '测试日期'))
})

test('没有字段池时退回 列1..列6（可编辑但保存会被校验拦下，不静默存一套存不了值的表）', () => {
  const cols = baseTemplateCols([])
  assert.deepEqual(cols.map((c) => c.key), ['列1', '列2', '列3', '列4', '列5', '列6'])
  const v = validateTemplate(cols, [])
  assert.equal(v.ok, false)
})

test('blankCols 生成的是空白列（新增模版/加列的初值）', () => {
  assert.deepEqual(blankCols(3).map((c) => c.label), ['列1', '列2', '列3'])
  assert.ok(blankCols(3).every((c) => c.w === 90 && c.rowspan === 2))
})

test('nextFreeField 跳过已被占用的字段（含还没保存的自定义列）', () => {
  const cols = baseTemplateCols(POOL)
  assert.equal(nextFreeField(POOL, cols).label, '硫酸镁')
  const withPending = [...cols, { key: '氟化钠', label: '氟化钠', w: 90, pending: true }]
  assert.equal(nextFreeField(POOL, withPending).label, '硫酸镁')
  assert.equal(nextFreeField(POOL, POOL.map((f) => ({ key: f.label }))), null, '字段用满时返回 null')
})

test('加一列：沿用字段宽度，可指定分格', () => {
  const cols = baseTemplateCols(POOL)
  const one = appendColumn(cols, { label: '硫酸镁', width: 120 }, '试剂用量（g）')
  assert.equal(one.length, 7)
  assert.deepEqual(one[6], { key: '硫酸镁', label: '硫酸镁', w: 120, group: '试剂用量（g）' })
  // 不改原数组（对话框里取消要能回到原样）
  assert.equal(cols.length, 6)
})

test('校验：正常表通过', () => {
  assert.deepEqual(validateTemplate(baseTemplateCols(POOL), POOL), { ok: true, errors: [] })
})

test('校验：没列 / 列名为空 / 数据列没绑上，都拦下并说清是第几列', () => {
  assert.equal(validateTemplate([], POOL).ok, false)
  const noLabel = baseTemplateCols(POOL).map((c, i) => (i === 1 ? { ...c, label: '  ' } : c))
  const r1 = validateTemplate(noLabel, POOL)
  assert.equal(r1.ok, false)
  assert.match(r1.errors.join('；'), /第 2 列/)
  const unbound = baseTemplateCols(POOL).map((c, i) => (i === 2 ? { ...c, key: '不存在的字段' } : c))
  const r2 = validateTemplate(unbound, POOL)
  assert.equal(r2.ok, false)
  assert.match(r2.errors.join('；'), /第 3 列/)
})

test('校验：两列抢同一个数据列 / 同名显示，都拦下（会互相覆盖）', () => {
  const dupKey = baseTemplateCols(POOL).map((c, i) => (i === 5 ? { ...c, key: '测试日期' } : c))
  const r1 = validateTemplate(dupKey, POOL)
  assert.equal(r1.ok, false)
  assert.match(r1.errors.join('；'), /数据列重复/)

  const dupLabel = baseTemplateCols(POOL).map((c, i) => (i === 5 ? { ...c, label: '测试日期' } : c))
  const r2 = validateTemplate(dupLabel, POOL)
  assert.equal(r2.ok, false)
  assert.match(r2.errors.join('；'), /列名重复/)
})

test('校验：本次新建的自定义列（pending）允许通过，因为它会在保存时先登记成字段', () => {
  const cols = [...baseTemplateCols(POOL), { key: '氟化钠', label: '氟化钠', w: 90, pending: true }]
  assert.deepEqual(validateTemplate(cols, POOL), { ok: true, errors: [] })
})

test('校验：列名过长拦下（与字段管理同口径 ≤60 字）', () => {
  const cols = baseTemplateCols(POOL).map((c, i) => (i === 0 ? { ...c, label: '列'.repeat(61) } : c))
  assert.equal(validateTemplate(cols, POOL).ok, false)
})

test('存进去的 content 能被 parseLayout 原样读回（含分格/列宽/两行表头）', () => {
  const cols = [
    { key: '测试日期', label: '测试日期', w: 90 },
    { key: '硫酸镁', label: '硫酸镁', w: 90, group: '试剂用量（g）' },
    { key: '二水氯化钙', label: '二水氯化钙', w: 100, group: '试剂用量（g）' },
    { key: '负责人', label: '负责人', w: 70 },
  ]
  const content = layoutContent(cols)
  const back = parseLayout(content)
  assert.equal(back.ok, true)
  assert.deepEqual(back.cols.map((c) => c.key), ['测试日期', '硫酸镁', '二水氯化钙', '负责人'])
  assert.equal(back.cols[1].group, '试剂用量（g）')
  assert.equal(back.cols[0].rowspan, 2, '无分格的列必须补 rowspan:2（否则两行表头把它挤掉）')
  assert.equal(back.cols[1].rowspan, undefined, '有分格的列不再自己 rowspan')
  assert.equal(back.cols[2].w, 100)
})

test('layoutContent 不把编辑态字段（pending/dataType）写进标准库', () => {
  const content = layoutContent([{ key: '氟化钠', label: '氟化钠', w: 90, pending: true, dataType: '文本' }])
  const obj = JSON.parse(content)
  assert.deepEqual(Object.keys(obj.cols[0]).sort(), ['key', 'label', 'rowspan', 'w'])
})

test('模版摘要：合法结构给列数/分格；老式纯文本条目明确判为「未设计」', () => {
  const ok = summarizeTemplate(layoutContent(baseTemplateCols(POOL)))
  assert.equal(ok.ok, true)
  assert.equal(ok.count, 6)
  assert.deepEqual(ok.groups, [])

  const grouped = summarizeTemplate(layoutContent([
    { key: 'a', label: 'A', w: 90, group: 'G1' },
    { key: 'b', label: 'B', w: 90, group: 'G2' },
    { key: 'c', label: 'C', w: 90, group: 'G1' },
  ]))
  assert.deepEqual(grouped.groups, ['G1', 'G2'], '分格名去重')

  for (const legacy of ['NSF 42氯胺', '', null, '{"cols":[]}']) {
    const s = summarizeTemplate(legacy)
    assert.equal(s.ok, false, JSON.stringify(legacy) + ' 应判为未设计')
    assert.equal(s.count, 0)
  }
})
