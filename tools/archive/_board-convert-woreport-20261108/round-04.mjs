// round-04.mjs — 订单结转:跳到最近有数据的一天后做「备品超订单」前端取证(不落库)
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/wo-board-freeze-20261108'
await fs.mkdir(OUT, { recursive: true })
const task = await taskSpace('wo-board-freeze-cols-20261108')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/prod/plan/orderConvert', { timeout: 40000 })
await page.waitForTimeout(5000)

// 处理打开页面时的「没有数据 → 跳最近有数据一天」询问框
const jumped = await page.evaluate(() => {
  const boxes = [...document.querySelectorAll('.el-message-box')]
  const b = boxes[boxes.length - 1]
  if (!b) return 'no-dialog'
  const btn = [...b.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '跳转')
  if (!btn) return 'no-jump'
  btn.click()
  return 'jumped'
})
console.log('jump: ' + jumped)
await page.waitForTimeout(4500)

const state = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
  return {
    rowCount: rows.length,
    firstRow: rows[0] ? (rows[0].innerText || '').replace(/\s+/g, ' ').trim().slice(0, 240) : '',
  }
})
console.log('rows: ' + JSON.stringify(state, null, 2))

const out = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  for (const tr of rows) {
    const tds = [...tr.querySelectorAll('td')]
    const cell = tds[tds.length - 1]
    const inp = cell ? cell.querySelector('input') : null
    if (!inp) continue
    const cur = Number(inp.value || 0)
    if (!Number.isFinite(cur) || cur <= 0) continue
    const before = cur
    // 焦点 + 输入超过剩余量的值(剩余量在倒数第 3 列)
    inp.focus()
    setVal(inp, String(cur + 100))
    inp.dispatchEvent(new Event('blur', { bubbles: true }))
    const label = (tds[0]?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60)
    const remain = (tds[tds.length - 3]?.innerText || '').replace(/\s+/g, ' ').trim()
    return { label, remain, before, after: cur + 100 }
  }
  return null
})
console.log('over-order input: ' + JSON.stringify(out))
await page.waitForTimeout(1800)

const marks = await page.evaluate(() => {
  const trs = [...document.querySelectorAll('.el-table__body tbody tr')]
  const hit = trs.find((tr) => (tr.innerText || '').includes('超订单'))
  if (!hit) return { found: false }
  const tds = [...hit.querySelectorAll('td')]
  const cell = tds[tds.length - 1]
  const inp = cell.querySelector('input')
  const wrap = inp ? inp.closest('.el-input-number') : null
  return {
    found: true,
    cellText: (cell.innerText || '').replace(/\s+/g, ' ').trim(),
    wrapperClass: wrap ? wrap.className : '',
    title: wrap ? (wrap.getAttribute('title') || '') : '',
  }
})
console.log('over-order marks: ' + JSON.stringify(marks, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/round-04-over-input.png' })

// 勾选该行后点「转工单」→ 应弹「备品超订单提示」(不确认)
const pre = await page.evaluate(() => {
  const trs = [...document.querySelectorAll('.el-table__body tbody tr')]
  const hit = trs.find((tr) => (tr.innerText || '').includes('超订单'))
  if (!hit) return 'no-over-row'
  const cb = hit.querySelector('td .el-checkbox')
  if (cb) cb.click()
  return 'checked'
})
console.log('check row: ' + pre)
await page.waitForTimeout(800)
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').replace(/\s+/g, '').includes('转工单'))
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
await page.screenshot({ path: OUT + '/round-04-confirm.png' })
// 取消:绝不确认(避免在正式账造工单)
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
await page.waitForTimeout(1000)
await page.screenshot({ path: OUT + '/round-04-after-cancel.png' })
