/**
 * annPenClickToOpen.test.js —— 标注笔改为「划选 → 再点一下 → 弹色盘」
 *
 * 【用户口径 2026-10-28】「现在优化一下标注笔的使用方法，现在改为是可以直接鼠标划选
 *   然后点击一下就弹出颜色盘选择颜色」
 *
 * 【改前】mouseup 一抬手就弹色盘（`onMouseUp` 里直接 `ctx.ask`）——
 *   划选过程中只要松手就弹，误触很多（想选中看清某句话也会弹），且弹完立刻 `removeAllRanges`，
 *   用户连自己选了哪几个字都没看清。
 *
 * 【改后】两段式:
 *   ① 划选（mouseup）→ 只**记住**范围并高亮，不弹盘；
 *   ② 在被选中的文字上**再点一下**（click）→ 才弹色盘。
 *   为什么必须用 click 而不是继续用 mouseup:拖拽选字的落点就是 mouseup，
 *   用户说的"点击一下"是**第二次**独立点击。所以 mouseup 只 arm，click 才 fire。
 *
 * 【同一次拖拽不能算"点击"】Chrome 在 mousedown/mouseup 同一元素上会补发 click，
 *   若不加判据，划选完的那次 click 会立刻弹盘 = 退回改前行为。
 *   判据 = mouseup 到 click 的时间差（拖拽补发的 click 几乎为 0ms）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('./AnnotatedText.vue', import.meta.url), 'utf8')
const panelx = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')

test('mouseup 只记住范围，不再直接弹色盘', () => {
  const at = src.indexOf('function onMouseUp')
  assert.ok(at >= 0, '找不到 onMouseUp')
  // 切到下一个函数定义为止（onMouseUp 后面紧跟 fireIfArmed）
  const end = src.indexOf('function fireIfArmed', at)
  const body = src.slice(at, end > at ? end : at + 1500)
  assert.ok(!/ctx\.ask\?\./.test(body),
    'onMouseUp 里不能再调 ctx.ask（一抬手就弹盘就是用户要改掉的旧行为）')
  assert.match(body, /armed/, 'mouseup 要记录待确认范围(armed)')
  assert.ok(!/removeAllRanges/.test(body),
    'mouseup 就 removeAllRanges 会让用户看不清选中了什么 —— 改到弹盘之后才清')
})

test('click 时才弹色盘（第二次独立点击）', () => {
  const at = src.indexOf('function fireIfArmed')
  assert.ok(at >= 0, '找不到 fireIfArmed（弹盘的唯一出口）')
  const body = src.slice(at, at + 1400)
  assert.match(body, /ctx\.ask\?\./, 'click 里要调 ctx.ask 弹色盘')
  assert.match(body, /armed/, 'click 要用 mouseup 记下的范围')
  // 时间差已不再是主判据（改用选区是否已清），但兜底上限仍在 → 见下一条测试
})

test('拖拽补发的 click 不算"再点一下"（判据 = 选区是否已清）', () => {
  const at = src.indexOf('function fireIfArmed')
  const body = src.slice(at, at + 1400)
  // 实测：时间差判据不可靠（用户稍停再点就超阈值；手快时真点击又会被误判成补发）
  assert.ok(!/CLICK_GAP_MS/.test(body), '不能再用时间差当主判据')
  assert.match(body, /getSelection/, '要读当前选区')
  assert.match(body, /isCollapsed/, '判据 = 选区是否已被清（点击会取消选择）')
  assert.match(body, /stillSelecting/, '要有一个明确的"还在划选中"分支')
  // 兜底上限仍要留着（防很久以后误弹）
  assert.match(src, /const armMaxAgeMs\s*=\s*\d+/, '要有一个兜底上限常量')
  assert.match(body, /armMaxAgeMs/, '兜底上限要用上')
})

test('click 委托到 fireIfArmed（onClick 自己不再重复判时间）', () => {
  const at = src.indexOf('function onClick')
  const body = src.slice(at, at + 1200)
  assert.match(body, /fireIfArmed/, 'onClick 要调用 fireIfArmed')
})

test('armed 是响应式的（要高亮"已选中、待点击"）', () => {
  assert.match(src, /const armed\s*=\s*ref\(/, 'armed 要用 ref，才能在纸面上给出视觉反馈')
})

test('划选后不清空浏览器选区（用户要先看清自己选了哪几个字）', () => {
  const at = src.indexOf('function onMouseUp')
  const end = src.indexOf('function fireIfArmed', at)
  const body = src.slice(at, end > at ? end : at + 1500)
  assert.ok(!/removeAllRanges/.test(body),
    'mouseup 就 removeAllRanges 会让用户看不清选中了什么 —— 改到弹盘之后才清')
})

test('侧栏提示文案改成新交互', () => {
  assert.match(panelx, /划选文字后点一下/, '提示要说明"划选 + 点一下"两步')
  assert.match(en, /'划选文字后点一下，即弹出颜色盘选择颜色':/,
    '新增 UI 文案必须有多语言词条(en 至少)')
})
