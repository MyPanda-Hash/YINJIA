// 2026-11-13 round-10:排查入口缓存 —— 浏览器内 fetch index.html(绕页面缓存)+ 强跳新 URL(带 bust)
const task = await taskSpace('wo-dayplan-orig-20261113')
const page = task.page('p1')
const BASE = 'http://127.0.0.1:8091'
async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
const inBrowser = await page.evaluate(async () => {
  const out = {}
  for (const u of ['/index.html', '/']) {
    try {
      const r = await fetch(u, { cache: 'no-store' })
      const t = await r.text()
      out[u] = { status: r.status, chunk: (t.match(/assets\/index-[A-Za-z0-9_-]+\.js/) || [])[0] || '', len: t.length }
    } catch (e) { out[u] = 'ERR ' + e.message }
  }
  return out
})
console.log('IN-BROWSER fetch=' + JSON.stringify(inBrowser))
// 强跳一个新 URL(index.html + query),迫使浏览器重新取入口文档
await page.evaluate(() => { location.href = '/index.html?bust=' + Date.now() + '#/prod/plan/workOrderBoard' })
await page.waitForTimeout(9000)
await restoreWindow()
if (await page.evaluate(() => !!document.querySelector('input[type="password"]'))) {
  console.log('login required')
  await page.evaluate(() => {
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')) ?? ins[0], 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')) ?? ins[1], '123456')
    document.querySelector('.login-form .el-select')?.click()
  })
  await page.waitForTimeout(1200)
  await page.evaluate(() => { const items = [...document.querySelectorAll('.el-select-dropdown__item')]; const el = items.find((x) => { const t = (x.textContent || '').trim(); return t.includes('YINJIA-MES') && !t.includes('测试') }); if (el) el.click() })
  await page.waitForTimeout(500)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统')); if (b) b.click() })
  await page.waitForTimeout(6500)
  await page.evaluate(() => { location.href = '/index.html?bust=' + Date.now() + '#/prod/plan/workOrderBoard' })
  await page.waitForTimeout(8000)
}
const info = await page.evaluate(() => ({
  build: document.querySelector('script[type="module"]')?.getAttribute('src') || '',
  wbChunk: (performance.getEntriesByType('resource').map((r) => r.name).find((n) => /WorkOrderBoard-/.test(n)) || '').split('/').pop(),
}))
console.log('AFTER BUST build=' + JSON.stringify(info))
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith('1号车间'))
  if (el) el.click()
})
await page.waitForTimeout(3500)
const snap = await page.evaluate(() => ({
  banner: (document.querySelector('.wb-short-bar') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
  hint: (document.querySelector('.wb-short-hint') || {}).textContent?.trim() || '',
  red: document.querySelectorAll('.dp-plan.short').length,
}))
console.log('AFTER BUST board=' + JSON.stringify(snap))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-dayplan-orig-20261113/round-21-final-bust.png' })
console.log('DONE')
