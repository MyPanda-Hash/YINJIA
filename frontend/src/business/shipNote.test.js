import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  shipNoteRows, shipNoteTotal, shipNoteHtml, SHIP_NOTE_HEAD, SHIP_NOTE_SIGNERS, PLACEHOLDER_BATCHES,
} from './shipNote.js'

/**
 * 出货单取数口径守卫(2026-11-28)。
 * 用户口径:「分批次号的明细,根据同一物料成一行来打印」⇒ 同一物料合成一行、批号进备注。
 * 这些断言钉住的都是**印错了就会被客户看见**的点:
 *   合并键、批号去重/占位过滤、订单编号按行取、合计、空行跳过。
 */

const line = (o) => ({ 存货编码: '', 存货名称: '', 规格型号: '', 计量单位: '', 数量: 0, 批次号: '', 源单编号: '', ...o })

test('同一物料(同单位)合成一行:数量求和、批号按出现顺序去重进备注', () => {
  const rows = shipNoteRows([
    line({ 存货编码: 'B-47-13', 存货名称: 'X+级烧结炭棒/滤芯', 规格型号: 'L: 275±0.5mm', 计量单位: '支', 数量: 300, 批次号: '20261114-BST-001', 源单编号: 'LZW-20261116-05' }),
    line({ 存货编码: 'B-47-13', 存货名称: 'X+级烧结炭棒/滤芯', 规格型号: 'L: 275±0.5mm', 计量单位: '支', 数量: 200, 批次号: '104-015-010', 源单编号: 'LZW-20261116-05' }),
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0]['产品编码'], 'B-47-13')
  assert.equal(rows[0]['数量'], 500)
  assert.equal(rows[0]['单位'], '支')
  assert.equal(rows[0]['备注'], '20261114-BST-001, 104-015-010')
  assert.equal(rows[0]['订单编号'], 'LZW-20261116-05')
})

test('不同物料各成一行,保持首次出现顺序(不排序)', () => {
  const rows = shipNoteRows([
    line({ 存货编码: 'T228', 存货名称: 'X烧结阻垢炭棒/滤芯', 数量: 50, 单位: '支', 计量单位: '支' }),
    line({ 存货编码: 'B-47-13', 存货名称: 'X+级烧结炭棒/滤芯', 数量: 500, 计量单位: '支' }),
  ])
  assert.deepEqual(rows.map((r) => r['产品编码']), ['T228', 'B-47-13'])
})

test('同一编码但计量单位不同 ⇒ 分成两行(数量不能跨单位相加)', () => {
  const rows = shipNoteRows([
    line({ 存货编码: 'A-1', 存货名称: '炭棒', 计量单位: '支', 数量: 10 }),
    line({ 存货编码: 'A-1', 存货名称: '炭棒', 计量单位: '件', 数量: 2 }),
  ])
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map((r) => `${r['单位']}:${r['数量']}`), ['支:10', '件:2'])
})

test('占位批号 PC0000 与空批号不进备注;真实批号保留', () => {
  const rows = shipNoteRows([
    line({ 存货编码: 'A-1', 数量: 1, 批次号: PLACEHOLDER_BATCHES[0] }),
    line({ 存货编码: 'A-1', 数量: 1, 批次号: '' }),
    line({ 存货编码: 'A-1', 数量: 1, 批次号: '101-015-009' }),
    line({ 存货编码: 'A-1', 数量: 1, 批次号: '101-015-009' }),
  ])
  assert.equal(rows[0]['备注'], '101-015-009')
})

test('批号列两种键都认(在线数据列名是「批次号」,探针/物理列叫「批号」)', () => {
  const rows = shipNoteRows([
    line({ 存货编码: 'A-1', 数量: 1, 批次号: '', 批号: '20261114-BST-001' }),
  ])
  assert.equal(rows[0]['备注'], '20261114-BST-001')
})

test('订单编号按行取「源单编号」;行上没有才退回表头「销售订单号」;多张订单逗号拼接', () => {
  const rows = shipNoteRows([
    line({ 存货编码: 'A-1', 数量: 1, 源单编号: 'LZW-20261127-02' }),
    line({ 存货编码: 'A-1', 数量: 1, 源单编号: 'LZW-20261116-05' }),
    line({ 存货编码: 'A-1', 数量: 1, 源单编号: 'LZW-20261127-02' }),
  ], { 销售订单号: 'HEAD-ORDER' })
  assert.equal(rows[0]['订单编号'], 'LZW-20261127-02, LZW-20261116-05')

  const fallback = shipNoteRows([line({ 存货编码: 'A-2', 数量: 1, 源单编号: '' })], { 销售订单号: 'HEAD-ORDER' })
  assert.equal(fallback[0]['订单编号'], 'HEAD-ORDER')
})

test('空行(无编码无名称)跳过;只有名称没有编码仍出一行', () => {
  const rows = shipNoteRows([
    line({}),
    null,
    line({ 存货名称: '临时物料', 数量: 3 }),
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0]['产品编码'], '临时物料')
  assert.equal(rows[0]['数量'], 3)
})

test('合计 = 各行数量之和(含小数,保留原始小数位)', () => {
  const rows = shipNoteRows([
    line({ 存货编码: 'A-1', 数量: 0.5, 计量单位: 'kg' }),
    line({ 存货编码: 'A-2', 数量: 2, 计量单位: 'kg' }),
    line({ 存货编码: 'A-2', 数量: 1.25, 计量单位: 'kg' }),
  ])
  assert.equal(shipNoteTotal(rows), 3.75)
})

test('HTML:抬头/标题/8 列/合计/说明/签字行/五联 齐全,且按物料合并后的行数渲染', () => {
  const html = shipNoteHtml(
    { 单据编号: 'XSCK-20261128-00016', 单据日期: '2026-11-28', 客户: '南京倍斯特环保科技有限公司', 客户编码: 'B-47' },
    [
      line({ 存货编码: 'B-47-13', 存货名称: 'X+级烧结炭棒/滤芯', 规格型号: 'L: 275±0.5mm', 计量单位: '支', 数量: 500, 批次号: '104-015-010', 源单编号: 'LZW-20261116-05' }),
      line({ 存货编码: 'T228', 存货名称: 'X烧结阻垢炭棒/滤芯', 规格型号: 'L: 284.5±0.5', 计量单位: '支', 数量: 50, 批次号: '101-015-009', 源单编号: 'LZW-20261127-02' }),
    ],
  )
  assert.ok(html.includes(SHIP_NOTE_HEAD.name), '公司抬头')
  assert.ok(html.includes('出货单'), '标题')
  assert.ok(html.includes('B-47') && html.includes('南京倍斯特环保科技有限公司') && html.includes('2026-11-28'), '表头三项')
  for (const th of ['序号', '订单编号', '产品编码', '产品种类', '产品整体规格', '数量', '单位', '备注']) {
    assert.ok(html.includes(`>${th}<`), `列头 ${th}`)
  }
  // 两行物料(合计 550) + 合计行
  assert.ok(html.includes('LZW-20261116-05') && html.includes('LZW-20261127-02'), '两行订单编号')
  assert.ok(html.includes('合计'), '合计行')
  assert.ok(html.includes('>550<'), '合计数量 550')
  assert.ok(html.includes('有关质量问题交货三日内提出'), '说明条款')
  for (const s of SHIP_NOTE_SIGNERS) assert.ok(html.includes(`${s.label}：`), `签字行 ${s.label}`)
  assert.ok(html.includes('第五联'), '五联说明')
})

test('签字行:五格都有线 —— 具名格「名字带下划线」,空格留空白手签线', () => {
  const html = shipNoteHtml({ 单据编号: 'XSCK-1' }, [line({ 存货编码: 'A-1', 数量: 1 })])
  let underlines = 0
  for (const s of SHIP_NOTE_SIGNERS) {
    if (s.name) {
      // 具名格:线在**名字下面** ⇒ <span class="nm" style="min-width:NNpx">蒋小刚</span>
      const re = new RegExp(`${s.label}：<span class="nm" style="min-width:\\d+px">${s.name}</span>`)
      assert.ok(re.test(html), `${s.label} 的名字要压在下划线上(线在名字下面),不能是名字后面接线段`)
      assert.ok(s.nw > 0, `${s.label} 的下划线最小宽度 nw 必须 > 0(否则线不可见)`)
      underlines++
    } else {
      // 空格:标签后一条空白手签线
      const re = new RegExp(`${s.label}：<i class="line" style="width:\\d+px">`)
      assert.ok(re.test(html), `${s.label} 要有空白手签线`)
      assert.ok(s.w > 0, `${s.label} 的空白线长度 w 必须 > 0`)
      underlines++
    }
  }
  assert.equal(underlines, SHIP_NOTE_SIGNERS.length, '五个签字格都要有线')
  // .nm 的样式必须在(下划线跟着名字走),不能被别的规则覆盖掉
  assert.ok(html.includes('.sign .nm{') && html.includes('border-bottom:1px solid #333}'), '.nm 下划线样式缺失')
})

test('HTML:没有明细时仍出纸(只有表头 + 合计 0),不抛错', () => {
  const html = shipNoteHtml({ 单据编号: 'XSCK-EMPTY' }, [])
  assert.ok(html.includes('出货单'))
  assert.ok(html.includes('合计'))
})

test('HTML:值里的 < > & 被转义(客户名带 & 不能撕坏版面)', () => {
  const html = shipNoteHtml({ 客户: 'A&B <x>', 客户编码: 'C-1' }, [line({ 存货编码: 'A-1', 数量: 1 })])
  assert.ok(html.includes('A&amp;B &lt;x&gt;'))
  assert.ok(!html.includes('A&B <x>'))
})
