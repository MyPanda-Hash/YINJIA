/**
 * firstInspExport.test.js — 首件检验单「导出当前这张纸」的版式单测。
 *
 * 钉住用户口径(2026-10-17「让当前的 excel 可以导出当前这个报表页面」)下的六条:
 *   ① 大标题/副标题各占一行且横向合并全宽;
 *   ② 两层表头:第一级分组跨本组各列、第二级测试项目,左上角斜线格纵向合并两行;
 *   ③ 标准行取值与列同源;
 *   ④ 1#..8# 八个样品行,**每组只在自己那一对样品行上有值**、其余格写 `/`(与纸面同源);
 *   ⑤ 相关要求逐条一行、横向合并;表尾 检验结果|检验人|审核人 三组都在(审核人 2026-10-18 补,
 *      随首件检验单开直接审核);
 *   ⑥ 所有合并区**都不越界**(行列号都在 aoa 范围内)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildFirstInspExport, BLANK } from './firstInspExport.js'
import { columnsOf, groupsOf, DEFAULT_TEST_ITEMS } from './firstInspCols.js'

/** 按图纸的 10 列 + 长表明细造一份最简输入(与后端 FirstInspItems 的行键一致) */
function fixture() {
  const items = []
  let no = 0
  for (const d of DEFAULT_TEST_ITEMS) {
    items.push({ 表区: '首件检验', 行类型: '标准', 样品序号: '标准', 检验列: d.key, 检验项目: d.label, 项目分组: d.group, 标准: d.standard, 实测数值: '', 结果判断: '', 行号: ++no })
    for (let s = 1; s <= 8; s++) {
      items.push({ 表区: '首件检验', 行类型: '样品', 样品序号: `${s}#`, 检验列: d.key, 检验项目: d.label, 项目分组: d.group, 标准: '', 实测数值: '', 结果判断: '', 行号: ++no })
    }
  }
  const raw = columnsOf(items)
  const columns = groupsOf(raw).flatMap((g) => raw.filter((c) => c.group === g))
  return { items, columns }
}

const build = (over = {}) => {
  const { items, columns } = fixture()
  return {
    items, columns,
    ...buildFirstInspExport({
      title: '炭棒成型车间首件检验记录表',
      subtitle: '惠州市银嘉环保科技有限公司　单据编号：SJ-T-1',
      headPairs: [
        [{ label: '产品编号', value: '111' }, { label: '产品型号', value: 'X-1' }],
        [{ label: '生产日期', value: '2026-10-17' }, { label: '组别', value: '一楼' }],
      ],
      columns,
      items,
      requirements: ['要求一', '要求二', '要求三', '要求四', '要求五', '要求六'],
      foot: {
        resultLabel: '检验结果', result: '合格',
        byLabel: '检验人', by: '张三',
        auditorLabel: '审核人', auditor: '李四',
      },
      ...over,
    }),
  }
}

test('① 大标题与副标题各占一行且横向合并全宽', () => {
  const { aoa, merges, marks } = build()
  const N = marks.colCount
  assert.equal(N, 11, '1 个行标签列 + 图纸 10 个测试项目列')
  assert.equal(aoa[0][0], '炭棒成型车间首件检验记录表')
  assert.match(String(aoa[1][0]), /SJ-T-1/)
  assert.deepEqual(merges.find((m) => m.s.r === 0), { s: { r: 0, c: 0 }, e: { r: 0, c: N - 1 } })
  assert.deepEqual(merges.find((m) => m.s.r === 1), { s: { r: 1, c: 0 }, e: { r: 1, c: N - 1 } })
})

test('② 两层表头:分组跨本组各列、测试项目逐个、左上角斜线格纵跨两行', () => {
  const { aoa, merges, marks } = build()
  const { groupRow, itemRow } = marks
  assert.equal(aoa[groupRow][0], '测试项目 ╲ 样品序号')
  assert.equal(aoa[groupRow][1], '表观及脱粉')
  assert.equal(aoa[groupRow][3], '尺寸及重量')
  assert.equal(aoa[groupRow][7], '强度')
  assert.equal(aoa[groupRow][9], '浊度及压降')
  // 分组跨列:表观及脱粉 2 列、尺寸及重量 4 列、强度 2 列、浊度及压降 2 列
  const gm = (c) => merges.find((m) => m.s.r === groupRow && m.s.c === c)
  assert.deepEqual(gm(1), { s: { r: groupRow, c: 1 }, e: { r: groupRow, c: 2 } })
  assert.deepEqual(gm(3), { s: { r: groupRow, c: 3 }, e: { r: groupRow, c: 6 } })
  assert.deepEqual(gm(7), { s: { r: groupRow, c: 7 }, e: { r: groupRow, c: 8 } })
  assert.deepEqual(gm(9), { s: { r: groupRow, c: 9 }, e: { r: groupRow, c: 10 } })
  // 第二级 = 测试项目(带单位的拼单位;**列名里已含单位的不再重复后缀**)
  assert.equal(aoa[itemRow][1], '炭棒表观状态')
  assert.equal(aoa[itemRow][3], '炭棒外径(mm)')
  assert.equal(aoa[itemRow][9], '浊度NTU', '列名里已有 NTU ⇒ 不再写成 浊度NTU(NTU)')
  assert.equal(aoa[itemRow][10], '压降kPa', '列名里已有 kPa ⇒ 不再写成 压降kPa(kPa)')
  // 左上角纵跨两层表头
  assert.deepEqual(merges.find((m) => m.s.r === groupRow && m.s.c === 0 && m.e.r === itemRow),
    { s: { r: groupRow, c: 0 }, e: { r: itemRow, c: 0 } })
})

test('③ 标准行取自列对象;空标准照纸面写 `/`', () => {
  const { aoa, marks } = build()
  assert.equal(aoa[marks.stdRow][0], '标准')
  assert.equal(aoa[marks.stdRow][1], BLANK, '表观状态的标准纸面上就是 /')
  // ⚠ 纸张对"标准为空"的统一口径就是 **写 `/`**(只读态渲染 `{{ c.standard || '/' }}`),
  //   导出与纸面同源 ⇒ 这里也是 `/`,不是空白
  assert.equal(aoa[marks.stdRow][3], BLANK, '外径标准为空时照纸面写 /')
  const withStd = build({ columns: [{ key: 'outer', label: '炭棒外径', group: '尺寸及重量', unit: 'mm', standard: '外径:34.5±0.5' }] })
  assert.equal(withStd.aoa[withStd.marks.stdRow][1], '外径:34.5±0.5')
})

test('④ 八个样品行:可填范围与纸面同源(前两列只 1#/2#,其余列八行全可填)', () => {
  const { items, columns } = fixture()
  const put = (key, sample, v) => {
    const row = items.find((r) => r['检验列'] === key && r['样品序号'] === `${sample}#`)
    row['实测数值'] = v
  }
  put('appearance', 2, '无粘模（均匀）')
  put('outer', 1, '34.1')      // 外径在 1# 也能填(改前这里写的是 `/`)
  put('outer', 8, '34.8')      // 8# 也能填
  put('drop', 5, '5')
  put('turbidity', 7, '1.1')
  const { aoa, marks } = buildFirstInspExport({ columns, items })
  const idx = (key) => columns.findIndex((c) => c.key === key) + 1
  const rowOf = (s) => aoa[marks.dataStart + s - 1]
  for (let s = 1; s <= 8; s++) assert.equal(rowOf(s)[0], `${s}#`)
  assert.equal(rowOf(2)[idx('appearance')], '无粘模（均匀）')
  assert.equal(rowOf(1)[idx('outer')], '34.1')
  assert.equal(rowOf(8)[idx('outer')], '34.8')
  assert.equal(rowOf(5)[idx('drop')], '5')
  assert.equal(rowOf(7)[idx('turbidity')], '1.1')
  // 前两列**保持原样**:3#..8# 仍打 `/`
  for (const s of [3, 4, 5, 6, 7, 8]) {
    assert.equal(rowOf(s)[idx('appearance')], BLANK, `${s}# 的表观状态格照纸面是 /`)
    assert.equal(rowOf(s)[idx('depowder')], BLANK, `${s}# 的脱粉情况格照纸面是 /`)
  }
  // 其余列八行全可填:没值就是空(不是 `/`)
  for (const s of [1, 2, 3, 4, 5, 6, 7, 8]) {
    assert.notEqual(rowOf(s)[idx('length')], BLANK, `${s}# 的炭棒长度格应可填(空,不是 /)`)
  }
})

test('⑤ 相关要求逐条一行且横向合并;表尾三组(检验结果|检验人|审核人)都在', () => {
  const { aoa, merges, marks } = build()
  assert.equal(aoa[marks.reqTitleRow][0], '相关要求：')
  assert.equal(marks.reqRows.length, 6)
  assert.equal(aoa[marks.reqRows[0]][0], '要求一')
  assert.equal(aoa[marks.reqRows[5]][0], '要求六')
  for (const r of marks.reqRows) {
    assert.ok(merges.some((m) => m.s.r === r && m.s.c === 0 && m.e.c === marks.colCount - 1), `第 ${r} 行要合并全宽`)
  }
  // 表尾三段等分(2026-10-18 起三段:N=11 ⇒ 每段 3 列:0|1-2、3|4-5、6|7-10)
  const N = marks.colCount
  const pairW = Math.max(2, Math.floor(N / 3))
  const foot = aoa[marks.footRow]
  assert.equal(foot[0], '检验结果')
  assert.equal(foot[1], '合格')
  assert.equal(foot[pairW], '检验人')
  assert.equal(foot[pairW + 1], '张三')
  assert.equal(foot[pairW * 2], '审核人')
  assert.equal(foot[pairW * 2 + 1], '李四')
})

test('⑥ 所有合并区都在 aoa 范围内(不越界)', () => {
  const { aoa, merges } = build()
  const rows = aoa.length
  for (const m of merges) {
    assert.ok(m.s.r >= 0 && m.e.r >= m.s.r && m.e.r < rows, `行越界: ${JSON.stringify(m)}`)
    assert.ok(m.s.c >= 0 && m.e.c >= m.s.c, `列倒挂: ${JSON.stringify(m)}`)
    assert.ok(m.e.c <= (aoa[m.s.r] || []).length - 1 || m.e.c <= 10, `列越界: ${JSON.stringify(m)}`)
  }
})

test('⑥b 列数变化时合并不跑偏(单列/空列都兜得住)', () => {
  const one = build({ columns: [{ key: 'a', label: 'A', group: '强度', unit: '' }] })
  assert.equal(one.marks.colCount, 2)
  for (const m of one.merges) assert.ok(m.e.c <= 1, JSON.stringify(m))
  const none = buildFirstInspExport({ columns: [], items: [], requirements: [] })
  assert.equal(none.marks.colCount, 2, '一列都没有也要有合法的最小宽度')
  for (const m of none.merges) assert.ok(m.e.c <= 1, JSON.stringify(m))
})

test('⑦ 自定义分组/自定义列:不是勾选式列 ⇒ 八行全可填', () => {
  const cols = [{ key: 'x', label: '自定项', group: '我的组', unit: '', standard: 'S' }]
  const items = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => ({
    行类型: '样品', 样品序号: `${s}#`, 检验列: 'x', 检验项目: '自定项', 项目分组: '我的组',
    标准: '', 实测数值: s === 7 ? 'v7' : '', 结果判断: '', 行号: s,
  }))
  const { aoa, marks } = buildFirstInspExport({ columns: cols, items, requirements: [] })
  assert.equal(aoa[marks.groupRow][1], '我的组')
  assert.equal(aoa[marks.dataStart + 6][1], 'v7', '7# 有值就落上去')
  assert.equal(aoa[marks.dataStart + 0][1], '', '1# 也可填(空,不是 `/`)')
  for (let s = 0; s < 8; s++) {
    assert.notEqual(aoa[marks.dataStart + s][1], BLANK, `${s + 1}# 应可填`)
  }
})

test('⑦b 新增的勾选式列(改名成"表观状态")也照原样:只 1#/2#,其余打 `/`', () => {
  const cols = [{ key: 'extra', label: '炭棒表观状态', group: '浊度及压降', unit: '', standard: '/' }]
  const items = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => ({
    行类型: '样品', 样品序号: `${s}#`, 检验列: 'extra', 检验项目: '炭棒表观状态', 项目分组: '浊度及压降',
    标准: '', 实测数值: s <= 2 ? `v${s}` : '', 结果判断: '', 行号: s,
  }))
  const { aoa, marks } = buildFirstInspExport({ columns: cols, items, requirements: [] })
  assert.equal(aoa[marks.dataStart + 0][1], 'v1')
  assert.equal(aoa[marks.dataStart + 1][1], 'v2')
  for (let s = 3; s <= 8; s++) {
    assert.equal(aoa[marks.dataStart + s - 1][1], BLANK, `${s}# 该列照纸面打 /`)
  }
})
