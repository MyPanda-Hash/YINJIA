// 2026-11-12 round-02:① 打包版 8090 复核(与 5173 同数) ② 切英文查新增文案是否走 tt()
const task = await taskSpace('wo-line-consistency-20261112')
const page = task.page('p1')

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

// ① 8090(jar 内 static + 新后端)
await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(6000)
await restoreWindow()
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.textContent || '').includes('装箱2'))
  if (el) el.click()
})
await page.waitForTimeout(4500)
const j = await page.evaluate(() => ({
  line2: (() => {
    const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.textContent || '').includes('装箱2'))
    return el ? { qty: el.querySelector('.wb-qty')?.textContent?.trim(), sub: el.querySelector('.wb-line-sub')?.textContent?.replace(/\s+/g, ' ').trim() } : null
  })(),
  stats: (document.querySelector('.wb-ctx-stats') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
  rows: [...document.querySelectorAll('.wb-main .el-table__body tr.el-table__row')].length,
}))
console.log('8090=' + JSON.stringify(j))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-line-consistency-20261112/round-02-8090.png' })

// ② 切英文(mes_locale=en → reload),复核新增文案的英文译名
await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(6500)
await restoreWindow()
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.textContent || '').includes('装箱2') || (x.textContent || '').includes('Carton'))
  if (el) el.click()
})
await page.waitForTimeout(4500)
const en = await page.evaluate(() => ({
  stats: (document.querySelector('.wb-ctx-stats') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
  sampleLine: (() => {
    const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-sub') || {}).textContent?.includes('Reported'))
    return el ? { name: el.querySelector('.wb-line-name')?.textContent?.replace(/\s+/g, ' ').trim(), qty: el.querySelector('.wb-qty')?.textContent?.trim(), sub: el.querySelector('.wb-line-sub')?.textContent?.replace(/\s+/g, ' ').trim() } : null
  })(),
  anyChineseLeft: [...document.querySelectorAll('.wb-page .wb-line-sub, .wb-page .wb-ctx-stats')].map((x) => x.textContent).filter((t) => /[\u4e00-\u9fa5]/.test(t)),
}))
console.log('en=' + JSON.stringify(en, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-line-consistency-20261112/round-03-en.png' })
await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
