/**
 * docSheetFitWidth.test.js — 窄窗口下文书纸面「按比例缩到装得下」，不再横向滚动(用户口径 2026-11-11)
 *
 * 【用户原话】「项目实施计划，填写不会换行，表格宽度会限制重叠在一起」；
 *   追问后确认 = **窗口窄时要横向滚动、内容被挤**。
 *
 * 【改动前的真实行为】
 *   纸宽由 docSheetConfigs.FIXED_SHEET_W 定死(RD_APPROVAL/RD_PLAN = 1242、样品两单 1188/1220/1365),
 *   外层 `.approval-layout > .sheet-scroll { overflow-x: auto }` 负责兜住 ——
 *   ⇒ 1280 窗口下容器约 1100px,纸 1242px,**必须左右拖**才能看全(实测 clientW 1102 / scrollW 1242)。
 *   打印不受影响(`body.approval-printing .approval-sheet { width:100%!important }`),
 *   但那是**打印**路径,屏幕上的挤压仍在。
 *
 * 【本次口径】
 *   容器装不下时按 `zoom = 容器宽 ÷ 纸宽` 缩小整张纸(上限 1 = 宽屏不放大、下限 0.6 = 再小就看不清),
 *   缩到下限仍装不下才退回横向滚动。打印仍走原宽(不受 zoom 影响,因为 @media print 用 !important 覆盖)。
 *
 * 单测跑不了布局，按仓库既有做法读源码钉住（同 docSheetWidth.test.js）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ROOT = new URL('../../../', import.meta.url) // frontend/
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8')
const docSheet = read('src/core/views/DocSheet.vue')

test('① 纸面根节点挂了可算的缩放比例(sheetZoom)', () => {
  // 必须有一个按"容器宽 ÷ 纸宽"算出来的比例
  assert.match(docSheet, /sheetZoom/, 'DocSheet 没有 sheetZoom 计算属性 ⇒ 窄窗仍会横向滚动')
  // 比例必须封顶 1(宽屏不放大)且封底(再小就看不清)
  const m = docSheet.match(/const sheetZoom = computed\(\(\) => \{[\s\S]*?\n\}\)/)
  assert.ok(m, '找不到 sheetZoom 计算属性')
  const body = m[0]
  assert.match(body, /Math\.min\(\s*1\b/, 'sheetZoom 必须用 Math.min(1, …) 封顶（宽屏不放大）')
  // 下限可以是字面量，也可以是具名常量 —— 后者更可读，但要能查到它的数值在合理区间
  const lit = body.match(/Math\.max\(\s*(0?\.\d+)/)
  if (lit) {
    assert.ok(Number(lit[1]) >= 0.4 && Number(lit[1]) <= 0.9, `缩放下限 ${lit[1]} 不合理`)
  } else {
    const name = body.match(/Math\.max\(\s*([A-Z_]+)/)
    assert.ok(name, 'sheetZoom 必须有下限（太小可读性归零）')
    const def = docSheet.match(new RegExp(`const ${name[1]} = (0?\\.\\d+)`))
    assert.ok(def, `找不到 ${name[1]} 的数值定义`)
    assert.ok(Number(def[1]) >= 0.4 && Number(def[1]) <= 0.9, `缩放下限 ${def[1]} 不合理（0.4~0.9）`)
  }
})

test('② 缩放只对"定死纸宽"的面板生效(自适应宽的纸本来就不会溢出)', () => {
  const m = docSheet.match(/const sheetZoom = computed\(\(\) => \{[\s\S]*?\n\}\)/)
  const body = m[0]
  assert.match(body, /fixedSheetWidth/, '要根据 fixedSheetWidth 判断是否是定宽纸，不能对所有纸都缩放')
})

test('③ 比例真的套到根节点样式上(否则算了不用)', () => {
  const m = docSheet.match(/const sheetStyle = computed\(\(\) => \{[\s\S]*?\n\}\)/)
  assert.ok(m, '找不到 sheetStyle')
  assert.match(m[0], /zoom:/, 'sheetStyle 必须输出 zoom（否则 sheetZoom 白算）')
})

test('④ 容器宽变化要重新算(ResizeObserver + 卸载时断开)', () => {
  assert.match(docSheet, /ResizeObserver/, '没有 ResizeObserver ⇒ 拖窗口不会重算')
  assert.match(docSheet, /\.disconnect\(\)|disconnect\(\)/, '组件卸载必须 disconnect，否则观察器泄漏')
})

test('⑤ 打印仍是整页宽(缩放不能压过打印规则)', () => {
  // 现有打印规则带 !important,zoom 写在行内样式上也压不过它 —— 这条防的是"把 !important 删了"
  assert.match(docSheet, /body\.approval-printing \.approval-sheet \{[\s\S]*?width: 100% !important/,
    '打印仍须 width:100% !important（本轮的屏幕缩放不得影响出纸）')
})

test('⑥ 横向滚动保底仍在(缩到下限还装不下时还要能拖)', () => {
  const panelx = read('src/core/views/PanelxList.vue')
  assert.match(panelx, /\.approval-layout > \.sheet-scroll \{[\s\S]*?overflow-x: auto/,
    '缩放下限仍装不下时要能横向滚动，该保底规则不能被删')
})
