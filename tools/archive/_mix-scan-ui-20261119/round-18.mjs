// 干净的英文版截图(2026-11-17):先设语言,再强制 390 宽重进页面,等布局稳定再截
const task = await taskSpace('mix-scan-fuzzybar-i18n-20261117c')
const page = task.page('p1')

await page.cdp('Page.addScriptToEvaluateOnNewDocument', {
  source: `window.YjNative = { scan: function () {}, getBaseUrl: function () { return 'http://localhost:5173' } }`,
})
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 60000 })
await page.waitForTimeout(3000)
await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.reload()
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }
await page.waitForTimeout(800)
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(400)
const info = await page.evaluate(() => ({
  locale: localStorage.getItem('mes_locale'),
  viewportW: window.innerWidth,
  bars: [...document.querySelectorAll('.mm-bar')].map((el) => ({
    prepend: (el.querySelector('.el-input-group__prepend')?.textContent || '').trim(),
    inputW: Math.round(el.querySelector('input')?.getBoundingClientRect().width || 0),
    buttons: [...el.querySelectorAll('button')].map((b) => (b.textContent || '').trim()),
  })),
}))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/32-two-bars-en-clean.png' })

// 日文
await page.evaluate(() => localStorage.setItem('mes_locale', 'ja'))
await page.reload()
await page.waitForTimeout(6000)
await page.waitForTimeout(500)
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/33-two-bars-ja-clean.png' })

await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
await page.reload()
await page.waitForTimeout(5000)
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: 'all' })
