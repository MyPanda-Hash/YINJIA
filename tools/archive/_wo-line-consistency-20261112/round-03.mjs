// 2026-11-12 round-03:切英文复核新增文案(强制整页重载,避免 SPA hash 导航不重建 store)
const task = await taskSpace('wo-line-consistency-20261112')
const page = task.page('p1')

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(4000)
await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
// 整页重载:带 ?lang=en 让浏览器真正重新加载 index.html
await page.goto('http://127.0.0.1:8090/?lang=en#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(7000)
await restoreWindow()
const applied = await page.evaluate(() => ({
  htmlLang: document.documentElement.lang,
  localStorage: localStorage.getItem('mes_locale'),
  topbar: [...document.querySelectorAll('*')].length ? document.body.textContent.slice(0, 120).replace(/\s+/g, ' ') : '',
}))
console.log('applied=' + JSON.stringify(applied))
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.textContent || '').includes('装箱2') || /Carton|Packing/.test(x.textContent || ''))
  if (el) el.click()
})
await page.waitForTimeout(4500)
const en = await page.evaluate(() => ({
  stats: (document.querySelector('.wb-ctx-stats') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
  firstLines: [...document.querySelectorAll('.wb-line')].slice(0, 4).map((el) => ({
    name: el.querySelector('.wb-line-name')?.textContent?.replace(/\s+/g, ' ').trim(),
    qty: el.querySelector('.wb-qty')?.textContent?.trim(),
    sub: el.querySelector('.wb-line-sub')?.textContent?.replace(/\s+/g, ' ').trim(),
  })),
  chineseLeft: [...document.querySelectorAll('.wb-page .wb-line-sub, .wb-page .wb-ctx-stats')]
    .map((x) => x.textContent || '').filter((t) => /[\u4e00-\u9fa5]/.test(t)),
}))
console.log('en=' + JSON.stringify(en, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-line-consistency-20261112/round-03-en.png' })
// 还原中文
await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
