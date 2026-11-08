// round-07.mjs — 报工记录查询:用 XHR 钩子确认条件真的发出去(上次用 fetch 钩子抓不到=axios 走 XHR)
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/wo-board-freeze-20261108'
await fs.mkdir(OUT, { recursive: true })
const task = await taskSpace('wo-board-freeze-cols-20261108')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/WO_REPORT_LIST', { timeout: 40000 })
await page.waitForTimeout(6500)

await page.evaluate(() => {
  if (window.__yjXhrHook) return
  window.__yjXhrHook = true
  window.__yjXhrCalls = []
  const open = XMLHttpRequest.prototype.open
  const send = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (m, u) { this.__yjUrl = u; this.__yjMethod = m; return open.apply(this, arguments) }
  XMLHttpRequest.prototype.send = function (body) {
    try {
      const u = String(this.__yjUrl || '')
      if (u.includes('queryFormDataList')) {
        window.__yjXhrCalls.push({ url: u, body: body ? String(body).slice(0, 600) : '' })
      }
    } catch (e) { /* ignore */ }
    return send.apply(this, arguments)
  }
})

// 先填产品规格(文本),回车触发
const filled = await page.evaluate(() => {
  const f = [...document.querySelectorAll('.udl-fields .field')].find((x) => (x.querySelector('label')?.innerText || '').trim() === '产品规格')
  const inp = f && f.querySelector('input')
  if (!inp) return 'no-input'
  inp.focus()
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, '60*45')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }))
  return { value: inp.value }
})
console.log('fill 产品规格: ' + JSON.stringify(filled))
await page.waitForTimeout(4000)

const r1 = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
  const total = (document.querySelector('.el-pagination__total') || {}).innerText || ''
  return { rowCount: rows.length, total, calls: (window.__yjXhrCalls || []).slice(-2).map((c) => c.body) }
})
console.log('after Enter: ' + JSON.stringify(r1, null, 2))

// 再点工具栏「查询」
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').replace(/\s+/g, '') === '查询')
  if (b) b.click()
})
await page.waitForTimeout(4000)
const r2 = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
  const total = (document.querySelector('.el-pagination__total') || {}).innerText || ''
  return { rowCount: rows.length, total, calls: (window.__yjXhrCalls || []).slice(-3).map((c) => c.body) }
})
console.log('after 查询: ' + JSON.stringify(r2, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/round-07-query.png' })
