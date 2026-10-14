import { test } from 'node:test'
import assert from 'node:assert/strict'
import { docKeyOf, findStashedRow, stashKeysToDrop } from './tabDraft.js'

/**
 * 这组断言守的是 2026-10-15 用户报的问题:
 * 「在标签页面切换时,有时候未保存的数据会自动清理,应该是在未×掉页面的时候就应该保留填写的数据」。
 *
 * 活体取证(Edge + CDP,测试账套 YJ_TEST,RD_MOLD_PROC ↔ RD_ASM_PROC 两张草稿文书):
 *   · 成型工艺清单第 2 页签某格写入 PROBEKEEP-CLICK → 点顶部页签「组装工艺清单」再点回
 *     → 该格回到空值,**且全程没有任何「未保存提示」弹窗**(静默丢);
 *   · 同一面板**内部页签**(成型工艺清单 ↔ 修订记录)来回切 → 值原样保留。
 *
 * 机制(读码+实测):未保存的填写就长在列表行对象上(`:head="cur"`,cur = list[curIdx],
 * 子组件按引用直接改它);而切面板时 PanelxList 会 `list.value = []` 再重载 ⇒ 行对象连同
 * 填写内容一起被丢掉。所以"保留"只能是:离开前把那张单暂存起来,回来时按单号找回并放回。
 *
 * 本文件只钉纯逻辑(身份键口径 / 找回 / 何时该丢),组件接线在 PanelxList。
 * 页签关闭才丢 = 用户口径「未×掉页面就应该保留」。
 */

test('单据身份键:编号 → 单据编号 → 锭号 依次回退(与列表定位同一口径)', () => {
  assert.equal(docKeyOf({ 编号: 'MP-2026-10-0001' }), 'MP-2026-10-0001')
  assert.equal(docKeyOf({ 单据编号: 'SD-001' }), 'SD-001')
  assert.equal(docKeyOf({ 锭号: 'D-9' }), 'D-9')
  assert.equal(docKeyOf({ 编号: 'A', 单据编号: 'B' }), 'A', '编号 最优先(列表定位用的就是它)')
  assert.equal(docKeyOf({ 编号: '', 单据编号: 'B' }), 'B', '空串视为没有,继续回退')
  assert.equal(docKeyOf({ 名称: '无号行' }), '', '任何单号键都没有 ⇒ 空串(不可暂存/不可找回)')
  assert.equal(docKeyOf(null), '')
})

test('找回:在新载入的行集里按单号命中那一行(带回它的下标)', () => {
  const rows = [{ 编号: 'A' }, { 编号: 'B' }, { 编号: 'C' }]
  const hit = findStashedRow(rows, { 编号: 'B', 备注: '未保存的填写' })
  assert.equal(hit.index, 1)
  assert.equal(hit.row, rows[1], '必须返回列表里那个行对象本身(要靠引用放回暂存内容)')
})

test('找回:单号不在本页 ⇒ null(不猜、不新建行)', () => {
  assert.equal(findStashedRow([{ 编号: 'A' }], { 编号: 'Z' }), null)
  assert.equal(findStashedRow([], { 编号: 'A' }), null)
  assert.equal(findStashedRow(null, { 编号: 'A' }), null)
  assert.equal(findStashedRow([{ 编号: 'A' }], { 名称: '没有单号' }), null, '没有身份键就不该乱认一行')
})

test('页签还开着 ⇒ 暂存不许丢(切走再切回都要还在)', () => {
  const keys = ['RD_MOLD_PROC', 'RD_ASM_PROC']
  const tabPaths = ['/dashboard', '/panelx/list/RD_MOLD_PROC', '/panelx/list/RD_ASM_PROC']
  assert.deepEqual(stashKeysToDrop(keys, tabPaths), [])
})

test('页签被×掉 ⇒ 那份暂存该丢(这正是用户要的「×掉才清」)', () => {
  const keys = ['RD_MOLD_PROC', '/RD_ASM_PROC'.slice(1)]
  assert.deepEqual(stashKeysToDrop(keys, ['/panelx/list/RD_MOLD_PROC']), ['RD_ASM_PROC'])
  assert.deepEqual(stashKeysToDrop(keys, ['/panelx/list/RD_ASM_PROC']), ['RD_MOLD_PROC'])
  assert.deepEqual(stashKeysToDrop(keys, ['/dashboard']), keys, '两个页签都关了就都丢')
})

test('只有 /panelx/list/<面板号> 形态的页签算数;拿不到页签清单时不丢', () => {
  assert.deepEqual(stashKeysToDrop(['RD_MOLD_PROC'], ['/panelx/form/RD_MOLD_PROC']), ['RD_MOLD_PROC'],
    '表单页页签不是同一个页面,不能拿它当"还开着"')
  assert.deepEqual(stashKeysToDrop(['RD_MOLD_PROC'], []), ['RD_MOLD_PROC'])
  assert.deepEqual(stashKeysToDrop(['RD_MOLD_PROC'], undefined), [], '拿不到页签清单(异常路径)宁可留着,别把用户填的丢掉')
})
