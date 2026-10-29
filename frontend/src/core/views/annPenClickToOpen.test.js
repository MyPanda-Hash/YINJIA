/**
 * annPenClickToOpen.test.js —— 标注笔交互：**划选即弹**（业界主流）
 *
 * 【演进记录，别退回】
 *   v1（2026-10-16）：必须先点「标注笔」进模式 → 划选 → 弹盘。用户在只读纸上划字没反应。
 *   v2（2026-10-27）：纸面本来就只读时不必点按钮，划选即弹（penReady）。用户仍报"易误操作"。
 *   v3（2026-10-28 上午）：做成「划选 → 再点一下才弹」。**实战不可用**——
 *       浏览器第二次点击的 mousedown 会**先清掉选区**，"选区已清"这个信号天然歧义
 *       （既可能是"用户点第二下"，也可能是"用户点到别处"）⇒ 时灵时不灵，用户报"点了弹不出来"。
 *   v4（2026-10-28 下午，本版）：回到 **mouseup 即弹**，与主流实现一致。
 *
 * 【业界依据】（2026-10-28 查证）
 *   · recogito/text-annotator-js（BSD-3，最常用的文本标注库）：选中即创建注释/浮层；
 *     它用 `dismissOnNotAnnotatable` 处理"点空白处才收起"，而不是要求"再点一下"。
 *   · hypothesis/client：mouseup 后弹 Adder。
 *   · openannotation/annotator：同样 mouseup 后弹 Viewer/Adder。
 *   三家都没把"二次点击"当主路径 —— 那正是 v3 的 bug 来源。
 *
 * 【本版防误触靠什么】不是"再点一下"，而是：
 *   ① 只在**真正的文字选区**上弹（非空/未折叠/同一文本节点）⇒ 单纯点击不产生选区，不会误弹；
 *   ② 弹盘后立即清选区（主流同款）；
 *   ③ 不监听 click 参与弹盘判断 ⇒ 拖拽补发的 click 无从干扰。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('./AnnotatedText.vue', import.meta.url), 'utf8')
const panelx = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')

test('mouseup 里**直接**弹色盘（不再等第二次点击）', () => {
  const at = src.indexOf('function onMouseUp')
  assert.ok(at >= 0, '找不到 onMouseUp')
  const end = src.indexOf('function fireIfArmed', at)
  const body = src.slice(at, end > at ? end : at + 1600)
  assert.match(body, /ctx\.ask\?\./, 'mouseup 必须直接调 ctx.ask（v3 的"等第二次点击"已验证不可用）')
  // 反例守卫：不能再用"选区是否还在"这种歧义判据决定弹不弹
  assert.ok(!/stillSelecting/.test(body), '别再引入"选区已清/仍在"的判据 —— 那正是 v3 时灵时不灵的原因')
})

test('弹盘后立即清选区（主流做法：色盘出现后选区使命完成）', () => {
  const at = src.indexOf('function onMouseUp')
  const end = src.indexOf('function fireIfArmed', at)
  const body = src.slice(at, end > at ? end : at + 1600)
  assert.match(body, /removeAllRanges/, 'mouseup 弹盘后要清选区')
})

test('click 不再参与标注笔弹盘（避免拖拽补发的 click 干扰）', () => {
  const at = src.indexOf('function onClick')
  assert.ok(at >= 0, '找不到 onClick')
  const body = src.slice(at, at + 900)
  assert.ok(!/fireIfArmed/.test(body), 'onClick 不该再调 fireIfArmed（v3 的做法已废弃）')
  assert.match(body, /eraser/, 'click 只留给橡皮擦')
})

test('只在真正有选区时弹（单纯点击不该弹）', () => {
  const at = src.indexOf('function onMouseUp')
  const end = src.indexOf('function fireIfArmed', at)
  const body = src.slice(at, end > at ? end : at + 1600)
  // rangeInTextNode 本身保证:非空、未折叠、同一文本节点
  assert.match(body, /rangeInTextNode/, '必须用 rangeInTextNode 校验"是真正的文字选区"')
  assert.match(body, /if \(!r\) \{ armed\.value = null; return \}/, '没选区就直接返回，不弹盘')
})

test('侧栏提示文案说明"划选即弹"', () => {
  assert.match(panelx, /划选要标注的文字即弹出颜色盘/, '提示要与实际交互一致')
  assert.match(en, /'划选要标注的文字即弹出颜色盘':/, '新增 UI 文案必须有多语言词条(en 至少)')
})
