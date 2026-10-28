/**
 * printChannel.test.js — 页面内打印通道单测(2026-10-20)
 *
 * 钉死的三件事(都是现场事故的直接教训):
 *  ① **只走 window.print()**,不再开子窗口 —— mock 里根本没有 `window.open`,谁写回去就 TypeError;
 *  ② 打印层挂到 body 末尾、内容原样(含自带 <style>/@page),屏幕上不可见由 CSS 保证(这里只看挂载);
 *  ③ 打完(afterprint)整层摘掉 + document.title 还原;**连打两次不会叠两层**(上一次先被清掉)。
 * 运行:npm test(node --test);mock document/body,不起浏览器。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

const state = { printed: 0, listeners: {}, title: 'MES 原页面' }
function makeEl(tag) {
  return {
    tagName: String(tag).toUpperCase(), id: '', innerHTML: '', textContent: '', style: {},
    children: [], parent: null,
    appendChild(child) { child.parent = this; this.children.push(child); return child },
    remove() {
      const p = this.parent
      if (!p) return
      const i = p.children.indexOf(this)
      if (i >= 0) p.children.splice(i, 1)
      this.parent = null
    },
  }
}
const head = makeEl('head')
const body = makeEl('body')
const byId = (id) => [...body.children, ...head.children].find((c) => c.id === id) || null
globalThis.document = {
  get title() { return state.title },
  set title(v) { state.title = v },
  head, body,
  createElement: makeEl,
  getElementById: byId,
}
globalThis.window = {
  // ⚠ 只有 print / 事件;没有 open(用了就是 TypeError ⇒ 单测失败)
  print() { state.printed++ },
  addEventListener(type, fn) { state.listeners[type] = fn },
  removeEventListener(type, fn) { if (state.listeners[type] === fn) delete state.listeners[type] },
}
globalThis.requestAnimationFrame = (cb) => { cb(); return 1 }

const { printInPage, isPrintHostMounted, PRINT_HOST_ID } = await import('./printChannel.js')

/** 模拟浏览器打完(关掉打印对话框)后触发 afterprint */
const fireAfterPrint = () => state.listeners.afterprint?.()

test('打印一次:挂层 → window.print() → afterprint 摘层并还原标题', () => {
  const tpl = '<style>@page{size:75mm 100mm;margin:0}</style><div class="card">卡面</div>'
  const ok = printInPage('产品标识卡', tpl)
  assert.equal(ok, true)
  assert.equal(state.printed, 1, '应调用一次 window.print()')
  assert.equal(isPrintHostMounted(), true, '打印层已挂到 body')
  assert.equal(byId(PRINT_HOST_ID).innerHTML, tpl, '卡面 HTML 原样注入(含自带 @page)')
  assert.equal(byId('yj-print-host-css') !== null, true, '打印期 CSS 已挂到 head')
  assert.equal(state.title, '产品标识卡', '打印期间标题=标签名(另存 PDF 的默认文件名)')

  fireAfterPrint()
  assert.equal(isPrintHostMounted(), false, 'afterprint 后打印层应被摘掉')
  assert.equal(byId('yj-print-host-css'), null, '打印期 CSS 也应摘掉')
  assert.equal(state.title, 'MES 原页面', '标题应还原')
})

test('连打两次:上一次的层先被清掉,页面上始终只有一层(不叠加)', () => {
  printInPage('第一次', '<div class="card">A</div>')
  // 浏览器没触发 afterprint(用户直接关掉弹窗/打印卡住)就再打一次
  delete state.listeners.afterprint
  printInPage('第二次', '<div class="card">B</div>')
  const hosts = body.children.filter((c) => c.id === PRINT_HOST_ID)
  assert.equal(hosts.length, 1, 'body 里不得叠加两个打印层')
  assert.ok(hosts[0].innerHTML.includes('B'), '后一次的内容生效')
  const css = head.children.filter((c) => c.id === 'yj-print-host-css')
  assert.equal(css.length, 1, 'CSS 也只有一份')
  assert.equal(state.printed, 3, '每次打印各调一次 window.print()')
  fireAfterPrint()
  assert.equal(isPrintHostMounted(), false)
})

test('空内容也能走通(不抛错);title 为空时不改标题', () => {
  const before = state.title
  assert.equal(printInPage('', '<div>只有一行</div>'), true)
  assert.equal(state.title, before, 'title 传空 = 不改页面标题')
  fireAfterPrint()
})
