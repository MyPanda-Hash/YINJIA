/**
 * procInspCols 单测 —— 制程检验单纸张横表列模型的单一真源。
 *
 * 【这条为什么必须自动化守】2026-10-17 用户口径逐轮收敛:固定列(外观 端盖两头/管身两侧)+
 * 表头「列数」决定的自定义列。列模型一旦散在组件里,典型事故就是"加列时某处不跟着动、
 * 减列时某处不清空"(2026-09-30 功能性滤效「样品配方列数不同步」即此类)。这里把口径钉死。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  STD_SECTORS,
  MIN_COLS,
  MAX_COLS,
  canonicalSector,
  sectorTitle,
  bareItemName,
  isFixedItem,
  clampCols,
  customRowsOf,
  fixedRowOf,
  effectiveCols,
  buildSectors,
  removedRowsForCols,
  dropRows,
} from './procInspCols.js'

/** 照实库 ZC-2026-10-0001 的形态造样本(表区 + 检验项目 + 格数) */
const seed = () => ([
  { 表区: '外观', 检验项目: '端盖两头', 实测数值: '无异常', 格数: 1 },
  { 表区: '外观', 检验项目: '管身两侧', 实测数值: '无异常', 格数: 1 },
  { 表区: '外观', 检验项目: '其他外观项', 实测数值: '无异常', 格数: 1 },
  { 表区: '尺寸', 检验项目: '外径', 测量值1: 44.5, 格数: 5 },
  { 表区: '尺寸', 检验项目: '内径', 测量值1: 20.9, 格数: 5 },
  { 表区: '尺寸', 检验项目: '长度', 测量值1: 256.2, 格数: 5 },
  { 表区: '重量', 检验项目: '出货重量', 测量值1: 234.5, 格数: 5 },
  { 表区: '功能性测试', 检验项目: '炭棒无断裂', 实测数值: '无断裂' },
  { 表区: '功能性测试', 检验项目: '初始流速', 实测数值: '12.3L/min' },
  { 表区: '功能性测试', 检验项目: '压降', 实测数值: '15kpa' },
  { 表区: '功能性测试', 检验项目: '余氯去除率', 实测数值: '99.1%' },
])

test('纸面标准表区 = 外观 / 尺寸 / 重量(重量组纸面名叫「出货重量」),外观有 2 个固定项', () => {
  assert.deepEqual(STD_SECTORS.map((s) => s.key), ['外观', '尺寸', '重量'])
  assert.deepEqual(STD_SECTORS.find((s) => s.key === '外观').fixed, ['端盖两头', '管身两侧'])
  assert.equal(sectorTitle('重量'), '出货重量')
  assert.equal(sectorTitle('功能性测试'), '功能性测试')
})

test('表区别名:重要尺寸/主要尺寸 → 尺寸组,出货重量 → 重量组(不改行里的 表区 值)', () => {
  assert.equal(canonicalSector('重要尺寸'), '尺寸')
  assert.equal(canonicalSector('出货重量'), '重量')
  assert.equal(canonicalSector('外观'), '外观')
  const rows = [{ 表区: '重要尺寸', 检验项目: '尺寸-外径' }, { 表区: '出货重量', 检验项目: '单支重量' }]
  const keys = buildSectors(rows, 1).map((g) => g.key)
  assert.deepEqual(keys, ['外观', '尺寸', '重量'])          // 不再多出 重要尺寸/出货重量 两组
  assert.equal(buildSectors(rows, 1)[1].custom[0].row, rows[0])
})

test('裸名:带入写法「外观-端盖两头」也算固定列(按本行表区剥前缀)', () => {
  assert.equal(bareItemName('外观-端盖两头', '外观'), '端盖两头')
  assert.equal(bareItemName('端盖两头', '外观'), '端盖两头')
  assert.equal(bareItemName('尺寸-外径', '重要尺寸'), '外径')
  assert.equal(isFixedItem('外观', '外观-端盖两头', '外观'), true)
  assert.equal(isFixedItem('外观', '其他外观项', '外观'), false)
  assert.equal(isFixedItem('尺寸', '尺寸-外径', '重要尺寸'), false)
})

test('列数取值:空/0/负 → 1,超上限夹到 10,小数四舍五入', () => {
  assert.equal(MIN_COLS, 1)
  assert.equal(MAX_COLS, 10)
  for (const v of ['', null, undefined, 0, -3, 'x']) assert.equal(clampCols(v), 1)
  assert.equal(clampCols(99), 10)
  assert.equal(clampCols('3.6'), 4)
})

test('空单 + 列数=1 = 图2:外观 端盖两头|管身两侧|1 空列,尺寸 1 空列,重量 1 空列', () => {
  const groups = buildSectors([], 1)
  assert.deepEqual(groups.map((g) => g.title), ['外观', '尺寸', '出货重量'])
  assert.deepEqual(groups[0].fixed.map((f) => f.name), ['端盖两头', '管身两侧'])
  assert.deepEqual(groups[0].fixed.map((f) => f.row), [null, null])   // 行还没填 → 空列(不是丢列)
  assert.equal(groups[0].custom.length, 1)
  assert.equal(groups[0].custom[0].row, null)
  assert.equal(groups[1].custom.length, 1)
  assert.equal(groups[2].custom.length, 1)
})

test('自定义列恰好 = 列数:不足补空列,已有的行按次序落在前几列', () => {
  const rows = seed()
  const g = buildSectors(rows, 4).find((x) => x.key === '外观')
  assert.equal(g.custom.length, 4)
  assert.equal(g.custom[0].row['检验项目'], '其他外观项')
  assert.deepEqual(g.custom.slice(1).map((c) => c.row), [null, null, null])
  // 固定列不会混进自定义列
  assert.equal(g.custom.some((c) => c.row && c.row['检验项目'] === '端盖两头'), false)
})

test('effectiveCols:存量单行数比库里列数多时按行数(绝不藏数据);列数更大时按列数(铺空列)', () => {
  const rows = seed()
  assert.equal(effectiveCols('', rows), 4)         // 功能性测试 4 行 ⇒ 至少 4 列
  assert.equal(effectiveCols(2, rows), 4)
  assert.equal(effectiveCols(6, rows), 6)
  assert.equal(effectiveCols('', []), 1)
})

test('固定列行查找:没有对应行时留空,有则挂上(端盖两头/管身两侧)', () => {
  const rows = seed()
  assert.equal(fixedRowOf('外观', '端盖两头', rows), rows[0])
  assert.equal(fixedRowOf('外观', '管身两侧', rows), rows[1])
  const bare = [{ 表区: '外观', 检验项目: '外观-端盖两头' }]
  assert.equal(fixedRowOf('外观', '端盖两头', bare), bare[0])
  assert.equal(fixedRowOf('外观', '端盖两头', []), null)
})

test('减列:删掉各区第 keep+1 列起的自定义行,固定列一律不动', () => {
  const rows = seed()
  const removed = removedRowsForCols(rows, 1)
  // keep=1 ⇒ 每个表区只留第 1 个自定义列:外观 0 条(只有 其他外观项 一列)
  //   + 尺寸 2 条(内径/长度) + 重量 0 条(只有 出货重量 一列) + 功能性测试 3 条 = 5
  assert.equal(removed.length, 5)
  assert.equal(removed.includes(rows[0]), false)                    // 端盖两头(固定列)不许删
  assert.equal(removed.includes(rows[1]), false)                    // 管身两侧(固定列)不许删
  assert.equal(removed.includes(rows[2]), false)                    // 其他外观项 = 外观组第 1 列,留下
  assert.equal(removed.includes(rows[4]), true)                     // 内径 = 尺寸组第 2 列,删
  assert.equal(dropRows(rows, removed), 5)
  assert.deepEqual(rows.map((r) => r['检验项目']),
    ['端盖两头', '管身两侧', '其他外观项', '外径', '出货重量', '炭棒无断裂'])
  // 删完后按列数=1 渲染:外观 = 2 固定 + 1 自定义;尺寸 = 1(外径);重量 = 1(出货重量)
  const groups = buildSectors(rows, 1)
  assert.equal(groups.find((g) => g.key === '外观').custom.length, 1)
  assert.equal(groups.find((g) => g.key === '尺寸').custom[0].row['检验项目'], '外径')
  assert.equal(groups.find((g) => g.key === '重量').custom[0].row['检验项目'], '出货重量')
})

test('减列 keep 小于下限时按 1 处理(不会把整组列删空)', () => {
  const rows = seed()
  assert.equal(removedRowsForCols(rows, 0).length, removedRowsForCols(rows, 1).length)
})

test('非标准表区:有行才铺(功能性测试 4 列),没有行不凭空造组', () => {
  const keys = buildSectors(seed(), 4).map((g) => g.key)
  assert.deepEqual(keys, ['外观', '尺寸', '重量', '功能性测试'])
  assert.equal(buildSectors([{ 表区: '外观', 检验项目: '端盖两头' }], 1).length, 3)
})

test('未归类行(表区为空)不进任何列组,也不会被减列误删', () => {
  const rows = [{ 表区: '', 检验项目: '待归类项' }, ...seed()]
  assert.deepEqual(buildSectors(rows, 1).flatMap((g) => g.custom).filter((c) => c.row && !c.row['表区']).length, 0)
  assert.equal(removedRowsForCols(rows, 1).includes(rows[0]), false)
  assert.equal(customRowsOf('外观', rows).length, 1)
})

test('dropRows:只删点名的行,不存在的行安静跳过', () => {
  const rows = seed()
  assert.equal(dropRows(rows, [rows[0], { 表区: '外观' }]), 1)
  assert.equal(dropRows(rows, []), 0)
  assert.equal(dropRows(null, [{}]), 0)
})
