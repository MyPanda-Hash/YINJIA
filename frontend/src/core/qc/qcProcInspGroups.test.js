/**
 * 出货检验（功能/表观）明细行分组 —— 回归测试。
 *
 * 背景:2026-11-23 用户报障「新增批次后，填写内容跑到下面去了」。
 * 根因一:纸面数据格 `vertical-align: middle`，行高被多行检验方法/要求撑高后，
 *        批次格的输入框/判定被垂直居中，视觉上落在行的中下部(像掉到下一行)。
 * 根因二:分组按"数组里连续的同名行"归并；一旦行序变成 项目1-批1, 项目2-批1, 项目1-批2…
 *        同一项目会被拆成两组，纸面出现两块同名项目。
 * 修法:①数据格顶对齐(见 QcProcInspSheet.vue 的 qcProcInspItemWrap.test.js 断言)
 *      ②分组按身份全局归并(本文件)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGroups, isContiguouslyGrouped, groupKeyOf, setToken, tokenOf } from './qcProcInspGroups.js'

/** 造一行(可带内部批次) */
const row = (name, batch, extra = {}) => ({ 检验项目: name, 内部批次: batch, ...extra })

test('① 同名项目的批次行即使不相邻,也归并成同一组(内容不再出现第二块)', () => {
  const rows = [
    row('检验项目1', '本批'),
    row('检验项目2', '本批'),
    row('检验项目1', '新批次2'),
    row('检验项目2', '新批次2'),
    row('检验项目1', '新批次3'),
  ]
  const gs = buildGroups(rows)
  assert.equal(gs.length, 2)
  assert.deepEqual(gs.map((g) => g.name), ['检验项目1', '检验项目2'])
  assert.deepEqual(gs[0].rows.map((r) => r.内部批次), ['本批', '新批次2', '新批次3'])
  assert.deepEqual(gs[1].rows.map((r) => r.内部批次), ['本批', '新批次2'])
})

test('② 组顺序 = 项目身份首次出现顺序(不做排序)', () => {
  const rows = [row('B', '批1'), row('A', '批1'), row('B', '批2')]
  assert.deepEqual(buildGroups(rows).map((g) => g.name), ['B', 'A'])
})

test('③ 手工新增的空名字行用 Symbol token 区分,不会被塌成一组', () => {
  const a = row('', '本批')
  const b = row('', '本批')
  setToken(a, 'g1')
  setToken(b, 'g2')
  assert.equal(groupKeyOf(a), 't:g1')
  assert.equal(groupKeyOf(b), 't:g2')
  assert.equal(tokenOf(a), 'g1')
  const gs = buildGroups([a, b, row('', '新批次2')])
  // 第三行没有 token、名字也是空 ⇒ 与两个 token 行都不同组;它的存在不改前两组
  assert.ok(gs.length >= 2)
  assert.notEqual(gs[0].key, gs[1].key)
})

test('④ 不存在 token 时按检验项目文本分组(库里来的行)', () => {
  const rows = [row('外观', 'A'), row('外观', 'B')]
  const gs = buildGroups(rows)
  assert.equal(gs.length, 1)
  assert.equal(gs[0].key, 'n:外观')
  assert.equal(gs[0].rows.length, 2)
})

test('⑤ 连续性判定:批量顺序(项目1-批1,项目2-批1,项目1-批2)判定为不连续 ⇒ 触发重排', () => {
  const batchMajor = [
    row('项目1', '本批'), row('项目2', '本批'),
    row('项目1', '新批次2'), row('项目2', '新批次2'),
  ]
  assert.equal(isContiguouslyGrouped(batchMajor), false)
  const itemMajor = [
    row('项目1', '本批'), row('项目1', '新批次2'),
    row('项目2', '本批'), row('项目2', '新批次2'),
  ]
  assert.equal(isContiguouslyGrouped(itemMajor), true)
  assert.equal(isContiguouslyGrouped([]), true)
})
