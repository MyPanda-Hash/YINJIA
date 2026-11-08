// Round 3:筛选/搜索/英文界面/1920 宽度 终验(Lead,2026-11-08)
const OUT = 'C:/Users/vigna/ego/wo-progress-board-lead-final-20261108'
const task = await taskSpace('wo-progress-board-lead-final-20261108')
const page = task.page('p1')

async function restoreWindow(p) {
  try {
    const w = await p.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await p.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
async function shot(name) {
  await restoreWindow(page)
  console.log('shot:', await page.screenshot({ path: OUT + '/' + name }))
}
const txt = `(el) => (el?.textContent || '').replace(/\\s+/g, ' ').trim()`

await page.goto('http://localhost:5173/#/prod/plan/workOrderProgress', { timeout: 30000 })
await page.waitForTimeout(3500)

// ---------- ① 状态筛选:未完工 → 已完工 ----------
await page.evaluate(() => {
  const sel = document.querySelectorAll('.wpb-toolbar .el-select')[0]
  const w = sel?.querySelector('.el-select__wrapper') || sel?.querySelector('.el-input__wrapper') || sel
  if (w) w.click()
})
await page.waitForTimeout(800)
const pickedDone = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
  const it = items.find((x) => (x.textContent || '').trim() === '已完工' && x.offsetParent !== null)
  if (it) { it.click(); return true }
  return false
})
await page.waitForTimeout(2500)
const filterDone = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.wpb-grid-row')]
  const statuses = rows.map((r) => { const s = r.querySelector('.wpb-status'); return s ? (s.textContent || '').trim() : '' })
  return { picked: true, rowCount: rows.length, statuses: [...new Set(statuses)], summary: [...document.querySelectorAll('.wpb-stat')].map((s) => (s.textContent || '').replace(/\s+/g, ' ').trim()) }
})
console.log('FILTER_DONE(picked=' + pickedDone + '):', JSON.stringify(filterDone, null, 2))
await shot('round-03-filter-done.png')

// 切回未完工
await page.evaluate(() => {
  const sel = document.querySelectorAll('.wpb-toolbar .el-select')[0]
  const w = sel?.querySelector('.el-select__wrapper') || sel?.querySelector('.el-input__wrapper') || sel
  if (w) w.click()
})
await page.waitForTimeout(700)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.el-select-dropdown__item')].find((x) => (x.textContent || '').trim() === '未完工' && x.offsetParent !== null)
  if (it) it.click()
})
await page.waitForTimeout(2200)

// ---------- ② 关键字搜索 ----------
const kwOk = await page.evaluate(() => {
  const input = document.querySelector('.wpb-kw input')
  if (!input) return false
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(input, 'GD-2026-11-0008')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
  return true
})
await page.waitForTimeout(2500)
const search = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.wpb-grid-row')]
  return { rowCount: rows.length, firstRow: rows.length ? (rows[0].textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140) : '' }
})
console.log('SEARCH(kwOk=' + kwOk + '):', JSON.stringify(search, null, 2))

// 清空关键字
await page.evaluate(() => {
  const input = document.querySelector('.wpb-kw input')
  if (!input) return
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(input, '')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
})
await page.waitForTimeout(2200)

// ---------- ③ 英文界面 ----------
await page.evaluate(() => { localStorage.setItem('mes_locale', 'en') })
await page.reload({ timeout: 30000 })
await page.waitForTimeout(4500)
const en = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const head = txt(document.querySelector('.wpb-toolbar'))
  const stats = txt(document.querySelector('.wpb-stats'))
  const rows = [...document.querySelectorAll('.wpb-grid-row')]
  const ringNames = [...new Set([...document.querySelectorAll('.wpr-name')].map((x) => (x.textContent || '').trim()))]
  const headers = [...document.querySelectorAll('.wpb-grid-head span')].map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim())
  return { title: document.title, head, stats, headers, ringNames, rowCount: rows.length, hash: location.hash }
})
console.log('EN:', JSON.stringify(en, null, 2))
await shot('round-03-en.png')

// 还原中文
await page.evaluate(() => { localStorage.setItem('mes_locale', 'zh-CN') })
await page.reload({ timeout: 30000 })
await page.waitForTimeout(4000)

// ---------- ④ 1920 CSS 宽度(CDP 视口模拟) ----------
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
await page.waitForTimeout(2500)
const wide = await page.evaluate(() => ({
  viewport: [window.innerWidth, window.innerHeight],
  docScroll: { client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth },
  gridCols: (() => { const g = document.querySelector('.wpb-grid'); return g ? getComputedStyle(g).gridTemplateColumns : null })(),
  rowCount: document.querySelectorAll('.wpb-grid-row').length,
  ringCount: [...document.querySelectorAll('.wpb-grid-row svg')].filter((s) => s.querySelector('circle')).length,
  summary: [...document.querySelectorAll('.wpb-stat')].map((s) => (s.textContent || '').replace(/\s+/g, ' ').trim()),
}))
console.log('WIDE1920:', JSON.stringify(wide, null, 2))
await shot('round-03-board-1920.png')
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await page.waitForTimeout(500)
console.log('ROUND3_DONE')
