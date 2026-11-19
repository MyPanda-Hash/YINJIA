/**
 * firstInspExport.test.js — 首件检验单「导出当前这张纸」的版式单测。
 *
 * 钉住用户口径(2026-10-17「让当前的 excel 可以导出当前这个报表页面」)下的六条:
 *   ① 大标题/副标题各占一行且横向合并全宽;
 *   ② 两层表头:第一级分组跨本组各列、第二级测试项目,左上角斜线格纵向合并两行;
 *   ③ 标准行取值与列同源;
 *   ④ 1#..8# 八个样品行,**可填范围按纸面黄格**(第十轮 2026-11-14:表观/脱粉 1#/2#、尺寸四项 3#/4#、
 *      跌落+挤压强度 5#/6#、压降/浊度 7#/8#),可填格落值、其余格写 `/`(与纸面同源);
 *      10 列 × 8 行 = 落值格最多 20 个、`/` 恰 60 个;
 *   ⑤ 相关要求逐条一行、横向合并;表尾 检验结果|检验人|审核人 **三段**都在
 *      (审核人 2026-10-18 补;**批准 2026-11-19 删** —— 本单 2026-11-09 起单级审批,纸面没有二级);
 *   ⑥ 所有合并区**都不越界**(行列号都在 aoa 范围内)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildFirstInspExport, BLANK } from './firstInspExport.js'
import { columnsOf, groupsOf, DEFAULT_TEST_ITEMS, isFillableCell } from './firstInspCols.js'

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
        // 2026-11-19:纸面不再有「批准」格(单级审批),这里刻意不再传 approver
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

test('④ 八个样品行:可填范围与纸面同源(黄格 20 / `/` 60)', () => {
  const { items, columns } = fixture()
  const put = (key, sample, v) => {
    const row = items.find((r) => r['检验列'] === key && r['样品序号'] === `${sample}#`)
    row['实测数值'] = v
  }
  // 每个分组都往**纸面黄格**里填一个值
  put('appearance', 2, '无粘模（均匀）')
  put('outer', 3, '34.1')
  put('outer', 4, '34.4')
  put('drop', 5, '5')
  put('compress', 5, '12.0')
  put('turbidity', 8, '1.1')
  // 非可填格里塞了历史值:导出的纸上照纸面写 `/`(屏幕端另有只读回显,不吞数据是屏幕口径)
  put('appearance', 6, '历史值')
  put('outer', 1, '34.9')
  const { aoa, marks } = buildFirstInspExport({ columns, items })
  const idx = (key) => columns.findIndex((c) => c.key === key) + 1
  const rowOf = (s) => aoa[marks.dataStart + s - 1]
  for (let s = 1; s <= 8; s++) assert.equal(rowOf(s)[0], `${s}#`)
  // 逐格核对整张矩阵:可填格不是 `/`,不可填格必须是 `/`
  let fillable = 0
  let blanks = 0
  for (const c of columns) {
    for (let s = 1; s <= 8; s++) {
      const cell = rowOf(s)[idx(c.key)]
      if (isFillableCell(s, c)) {
        fillable++
        assert.notEqual(cell, BLANK, `${c.label} ${s}# 是黄格,不该写 /`)
      } else {
        blanks++
        assert.equal(cell, BLANK, `${c.label} ${s}# 是白格,必须写 /`)
      }
    }
  }
  assert.equal(fillable, 20, '10 列 × 2 行 = 20 个可填格')
  assert.equal(blanks, 60, '10 列 × 8 行 − 20 = 60 个 `/`')
  // 填进去的值落在**本列那两行**上
  assert.equal(rowOf(2)[idx('appearance')], '无粘模（均匀）')
  assert.equal(rowOf(3)[idx('outer')], '34.1')
  assert.equal(rowOf(4)[idx('outer')], '34.4')
  assert.equal(rowOf(5)[idx('drop')], '5')
  assert.equal(rowOf(5)[idx('compress')], '12.0')
  assert.equal(rowOf(8)[idx('turbidity')], '1.1')
  // 可填但没填 = 空(不是 `/`);不可填即便有历史值也照纸面写 `/`
  assert.equal(rowOf(6)[idx('drop')], '', '跌落 6# 可填、未填 ⇒ 空白')
  assert.equal(rowOf(7)[idx('drop')], BLANK, '跌落 7# 是白格 ⇒ `/`')
  assert.equal(rowOf(6)[idx('appearance')], BLANK, '表观 6# 是白格 ⇒ `/`(不吃历史值)')
  assert.equal(rowOf(1)[idx('outer')], BLANK, '外径 1# 是白格 ⇒ `/`(不吃历史值)')
})

test('⑤ 相关要求逐条一行且横向合并;表尾三段(检验结果|检验人|审核人),不再有「批准」', () => {
  const { aoa, merges, marks } = build()
  assert.equal(aoa[marks.reqTitleRow][0], '相关要求：')
  assert.equal(marks.reqRows.length, 6, '条数由入参决定(面板传什么就印几条)')
  assert.equal(aoa[marks.reqRows[0]][0], '要求一')
  assert.equal(aoa[marks.reqRows[5]][0], '要求六')
  for (const r of marks.reqRows) {
    assert.ok(merges.some((m) => m.s.r === r && m.s.c === 0 && m.e.c === marks.colCount - 1), `第 ${r} 行要合并全宽`)
  }
  // 表尾三段(2026-11-19 起三段:N=11 ⇒ base=3/rem=2,标签列 0/4/8,值格并到下一段之前)
  const foot = aoa[marks.footRow]
  assert.equal(foot[0], '检验结果')
  assert.equal(foot[1], '合格')
  assert.equal(foot[4], '检验人')
  assert.equal(foot[5], '张三')
  assert.equal(foot[8], '审核人')
  assert.equal(foot[9], '李四')
  // 旧第四格「批准」必须彻底消失(连标签都不许出现)
  assert.ok(!foot.some((v) => String(v).includes('批准')), '表尾不该再出现「批准」')
  // 三段的值格:1-3 / 5-7 / 9-10(段间不重叠)
  for (const [s, e] of [[1, 3], [5, 7], [9, 10]]) {
    assert.ok(merges.some((m) => m.s.r === marks.footRow && m.s.c === s && m.e.c === e), `值格合并 ${s}-${e}`)
  }
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

test('⑦ 自定义分组/自定义列:认不出列名 ⇒ 按分组兜底(未知组 7#/8#、强度组 5#/6#)', () => {
  const mk = (group) => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => ({
      行类型: '样品', 样品序号: `${s}#`, 检验列: 'x', 检验项目: '自定项', 项目分组: group,
      标准: '', 实测数值: s === 7 ? 'v7' : '', 结果判断: '', 行号: s,
    }))
    return buildFirstInspExport({
      columns: [{ key: 'x', label: '自定项', group, unit: '', standard: 'S' }], items, requirements: [],
    })
  }
  // 未知分组 ⇒ 落最后一对 7#/8#
  const unknown = mk('我的组')
  assert.equal(unknown.aoa[unknown.marks.groupRow][1], '我的组')
  assert.equal(unknown.aoa[unknown.marks.dataStart + 6][1], 'v7', '7# 是兜底可填格,有值就落上去')
  for (let s = 1; s <= 8; s++) {
    const cell = unknown.aoa[unknown.marks.dataStart + s - 1][1]
    if (s === 7) assert.equal(cell, 'v7')
    else if (s === 8) assert.equal(cell, '', '8# 也是兜底可填格(空,不是 /)')
    else assert.equal(cell, BLANK, `${s}# 不在兜底那两行 ⇒ /`)
  }
  // 强度组 ⇒ 5#/6#
  const strength = mk('强度')
  assert.equal(strength.aoa[strength.marks.dataStart + 6][1], BLANK, '强度组兜底在 5#/6#,7# 打 /')
  assert.equal(strength.aoa[strength.marks.dataStart + 4][1], '', '5# 可填(空,不是 /)')
})

test('⑦b 新增的勾选式列(改名成"表观状态"/"炭粉情况")也只 1#/2#,其余打 `/`', () => {
  for (const label of ['炭棒表观状态', '炭粉情况']) {
    const cols = [{ key: 'extra', label, group: '浊度及压降', unit: '', standard: '/' }]
    const items = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => ({
      行类型: '样品', 样品序号: `${s}#`, 检验列: 'extra', 检验项目: label, 项目分组: '浊度及压降',
      标准: '', 实测数值: s <= 2 || s === 5 ? `v${s}` : '', 结果判断: '', 行号: s,
    }))
    const { aoa, marks } = buildFirstInspExport({ columns: cols, items, requirements: [] })
    assert.equal(aoa[marks.dataStart + 0][1], 'v1')
    assert.equal(aoa[marks.dataStart + 1][1], 'v2')
    for (let s = 3; s <= 8; s++) {
      assert.equal(aoa[marks.dataStart + s - 1][1], BLANK, `${label} ${s}# 照纸面打 /`)
    }
  }
})
