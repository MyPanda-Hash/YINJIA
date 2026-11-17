// 2026-11-12 round-04:回归 —— ① 工单排产三页签(未完工/已完工/全部)数字与行数 ② 其它 linesSummary 消费页不炸
const task = await taskSpace('wo-line-consistency-20261112')
const page = task.page('p1')
const errors = []
page.on?.('console', (m) => { if (m && m.type && m.type() === 'error') errors.push(m.text()) })
page.on?.('pageerror', (e) => errors.push('pageerror: ' + (e && e.message)))

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { /* ignore */ }
}

// ① 工单排产:三个页签
await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(6000)
await restoreWindow()
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.textContent || '').includes('装箱2'))
  if (el) el.click()
})
await page.waitForTimeout(3500)
const tabs = ['未完工', '已完工', '全部']
for (let i = 0; i < tabs.length; i++) {
  const t = tabs[i]
  const clicked = await page.evaluate((label) => {
    const btn = [...document.querySelectorAll('.wb-head .el-radio-button')].find((b) => (b.textContent || '').trim() === label)
    if (!btn) return 'not-found'
    btn.querySelector('input, .el-radio-button__inner')?.click?.()
    btn.click()
    return 'ok'
  }, t)
  await page.waitForTimeout(3500)
  const info = await page.evaluate(() => ({
    stats: (document.querySelector('.wb-ctx-stats') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
    rows: document.querySelectorAll('.wb-main .el-table__body tr.el-table__row').length,
    firstRow: (() => {
      const tr = document.querySelector('.wb-main .el-table__body tr.el-table__row')
      return tr ? [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 6) : null
    })(),
  }))
  console.log('tab[' + t + '] clicked=' + clicked + ' ' + JSON.stringify(info))
  await page.screenshot({ path: 'C:/Users/vigna/ego/wo-line-consistency-20261112/round-04-tab-' + i + '.png' })
}

// ② 其它 linesSummary 消费页:生产工单 / 生产工序进度看板
for (const [name, url] of [['workOrderList', 'http://localhost:5173/#/prod/plan/workOrderList'], ['progressBoard', 'http://localhost:5173/#/prod/plan/workOrderProgressBoard']]) {
  await page.goto(url, { timeout: 40000 })
  await page.waitForTimeout(5500)
  await restoreWindow()
  const ok = await page.evaluate(() => ({
    hash: location.hash,
    bodyLen: (document.body.textContent || '').length,
    hasAlert: !!document.querySelector('.el-alert--error'),
    head: (document.querySelector('.wol-page, .wpb-page, .wb-page') ? 'page-ok' : 'page-missing'),
    lines: [...document.querySelectorAll('.wol-line, .wpb-sel, .el-select')].length,
  }))
  console.log(name + '=' + JSON.stringify(ok))
  await page.screenshot({ path: 'C:/Users/vigna/ego/wo-line-consistency-20261112/round-04-' + name + '.png' })
}
console.log('consoleErrors=' + JSON.stringify(errors.slice(0, 10)))
