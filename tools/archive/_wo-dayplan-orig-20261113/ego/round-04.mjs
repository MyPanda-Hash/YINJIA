// 2026-11-13 round-04:降级态(5173 源码 + 旧 8090 jar) + 8091 双击改数量回归 + 控制台报错
const task = await taskSpace('wo-dayplan-orig-20261113')
const page = task.page('p1')
const SHOT = 'C:/Users/vigna/ego/wo-dayplan-orig-20261113/'
const consoleErrors = []
try {
  page.on?.('console', (msg) => { if (msg.type?.() === 'error') consoleErrors.push(msg.text?.()) })
  page.on?.('pageerror', (e) => consoleErrors.push('pageerror: ' + (e.message || e)))
} catch (e) { console.log('console hook skip: ' + e.message) }

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

async function loginIfNeeded(BASE) {
  const need = await page.evaluate(() => !!document.querySelector('input[type="password"], input[placeholder*="密码"]'))
  if (!need) return false
  console.log(BASE + ' login required → auto login')
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')) ?? ins[0], 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')) ?? ins[1], '123456')
    document.querySelector('.login-form .el-select')?.click()
  })
  await page.waitForTimeout(1200)
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')]
    const el = items.find((x) => { const t = (x.textContent || '').trim(); return t.includes('YINJIA-MES') && !t.includes('测试') })
    if (el) el.click()
  })
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(5500)
  return true
}

// ── A) 5173 源码版 + 旧 8090:降级态必须是单数、无汇总条、无报错 ──────────────
await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(5000)
await restoreWindow()
const didLogin = await loginIfNeeded('5173')
if (didLogin) {
  await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 40000 })
  await page.waitForTimeout(5000)
}
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith('3号车间'))
  if (el) el.click()
})
await page.waitForTimeout(4000)
const deg = await page.evaluate(() => ({
  banner: (document.querySelector('.wb-short-bar') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
  redCells: document.querySelectorAll('.dp-plan.short').length,
  cells: [...document.querySelectorAll('.wb-main .el-table__body tr.el-table__row td .dp-plan')].slice(0, 4).map((el) => ({
    t: (el.textContent || '').trim(), cls: el.className, title: el.getAttribute('title'),
  })),
  hasErrorOverlay: !!document.querySelector('vite-error-overlay, #vite-error-overlay'),
}))
console.log('5173 degraded=' + JSON.stringify(deg))
await page.screenshot({ path: SHOT + 'round-09-5173-degraded.png' })

// ── B) 8091:双击改数量回归(预填=计划值,而不是报工数)──────────────────────
await page.goto('http://127.0.0.1:8091/#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(5000)
await restoreWindow()
await loginIfNeeded('8091')
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith('3号车间'))
  if (el) el.click()
})
await page.waitForTimeout(3500)
const dbl = await page.evaluate(() => {
  const cell = document.querySelector('.wb-main .el-table__body tr.el-table__row td .dp-plan')
  if (!cell) return { err: 'no-cell' }
  const before = (cell.textContent || '').trim()
  cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  return { before }
})
await page.waitForTimeout(800)
const input = await page.evaluate(() => {
  const inp = document.querySelector('.dp-input input')
  return inp ? { value: inp.value } : { err: 'no-input' }
})
await page.evaluate(() => {
  const inp = document.querySelector('.dp-input input')
  if (inp) inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }))
})
await page.waitForTimeout(500)
console.log('8091 dblclick=' + JSON.stringify(dbl) + ' input=' + JSON.stringify(input))
await page.screenshot({ path: SHOT + 'round-10-edit-prefill.png' })

// ── C) 8091:切「已完工 / 全部」页签,汇总条随页签重算(不报错)──────────────
for (const tab of ['已完工', '全部', '未完工']) {
  const r = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('.wb-head .el-radio-button')].find((x) => (x.textContent || '').trim() === t)
    if (!el) return 'not-found'
    el.querySelector('input, label, span')?.click?.()
    el.click()
    return 'clicked'
  }, tab)
  await page.waitForTimeout(2500)
  const s = await page.evaluate(() => ({
    banner: (document.querySelector('.wb-short-bar') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
    red: document.querySelectorAll('.dp-plan.short').length,
    rows: document.querySelectorAll('.wb-main .el-table__body tr.el-table__row').length,
  }))
  console.log('tab=' + tab + ' ' + r + ' ' + JSON.stringify(s))
}
await page.screenshot({ path: SHOT + 'round-11-board-tabs.png' })
console.log('CONSOLE_ERRORS=' + JSON.stringify(consoleErrors.slice(0, 10)))
console.log('DONE')
