// round-03.mjs — 订单结转「备品超订单」前端取证
// 只验界面:①输入允许超过剩余数量 ②红框+「超订单」小标 ③提交弹「备品超订单提示」确认框 → 点取消(不落库)
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/wo-board-freeze-20261108'
await fs.mkdir(OUT, { recursive: true })
const task = await taskSpace('wo-board-freeze-cols-20261108')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/prod/plan/orderConvert', { timeout: 40000 })
await page.waitForTimeout(5000)

const state = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
  const ths = [...document.querySelectorAll('.el-table__header th')].map((t) => (t.innerText || '').replace(/\s+/g, ' ').trim())
  const nums = [...document.querySelectorAll('input.el-input__inner')].length
  return { rowCount: rows.length, headers: ths, inputs: nums,
           firstRow: rows[0] ? (rows[0].innerText || '').replace(/\s+/g, ' ').trim().slice(0, 220) : '' }
})
console.log('page state: ' + JSON.stringify(state, null, 2))

// 找「剩余数量」>0 的第一行,把它「本次转单数量」输入框改成 剩余+100
const out = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new Event('blur', { bubbles: true }))
  }
  for (const tr of rows) {
    const tds = [...tr.querySelectorAll('td')]
    // 从左数最后一个 td 是「本次转单数量」? 右侧固定列顺序:剩余数量/工艺路线/本次转单数量
    const cell = tds[tds.length - 1]
    const inp = cell ? cell.querySelector('input') : null
    if (!inp) continue
    // 找到左侧「订单资料」里的单号,供日志
    const label = (tds[0]?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40)
    // 当前值
    const cur = Number(inp.value || 0)
    if (!Number.isFinite(cur) || cur <= 0) continue
    setVal(inp, String(cur + 100))
    return { label, before: cur, after: cur + 100, cellText: (cell.innerText || '').replace(/\s+/g, ' ').trim() }
  }
  return null
})
console.log('over-order input: ' + JSON.stringify(out))
await page.waitForTimeout(1500)

// 读取该行单元格状态(是否出现 超订单 小标、红框 class)
const marks = await page.evaluate(() => {
  const trs = [...document.querySelectorAll('.el-table__body tbody tr')]
  const hit = trs.find((tr) => (tr.innerText || '').includes('超订单'))
  if (!hit) return { found: false }
  const cell = hit.querySelectorAll('td')[hit.querySelectorAll('td').length - 1]
  const inp = cell.querySelector('input')
  return {
    found: true,
    tag: (cell.innerText || '').replace(/\s+/g, ' ').trim(),
    wrapperRed: inp ? /oc-over-qty/.test((inp.closest('.el-input') || {}).className || '') : null,
    title: inp ? inp.closest('.el-input-number')?.getAttribute('title') || '' : '',
  }
})
console.log('over-order marks: ' + JSON.stringify(marks, null, 2))

// 截图(改后/提交前)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/round-03-over-input.png' })

// 点「转工单」→ 应弹「备品超订单提示」确认框;截图后点取消
const clicked = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const b = btns.find((x) => (x.innerText || '').replace(/\s+/g, '').includes('转工单'))
  if (!b) return false
  b.click()
  return true
})
console.log('clicked convert: ' + clicked)
await page.waitForTimeout(2200)
const dlg = await page.evaluate(() => {
  const boxes = [...document.querySelectorAll('.el-message-box')]
  if (!boxes.length) return null
  const b = boxes[boxes.length - 1]
  return { title: (b.querySelector('.el-message-box__title') || {}).innerText || '',
           content: (b.querySelector('.el-message-box__message') || {}).innerText || '',
           buttons: [...b.querySelectorAll('button')].map((x) => (x.innerText || '').trim()) }
})
console.log('confirm dialog: ' + JSON.stringify(dlg, null, 2))
await page.screenshot({ path: OUT + '/round-03-confirm.png' })
// 取消(绝不落库)
const cancelled = await page.evaluate(() => {
  const boxes = [...document.querySelectorAll('.el-message-box')]
  const b = boxes[boxes.length - 1]
  if (!b) return 'no-dialog'
  const btn = [...b.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '取消')
  if (!btn) return 'no-cancel'
  btn.click()
  return 'cancelled'
})
console.log('cancel: ' + cancelled)
await page.waitForTimeout(1200)
await page.screenshot({ path: OUT + '/round-03-after-cancel.png' })
