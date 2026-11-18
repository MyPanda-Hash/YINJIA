// 复核(2026-11-17):英文/日文前缀缩短后,模糊查询栏的输入框宽度是否够用
const task = await taskSpace('mix-scan-fuzzybar-i18n-20261117b')
const page = task.page('p1')

async function check(locale, shot) {
  await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 60000 })
  await page.evaluate((l) => localStorage.setItem('mes_locale', l), locale)
  await page.reload()
  await page.waitForTimeout(5500)
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  await page.waitForTimeout(600)
  const info = await page.evaluate(() => {
    const bars = [...document.querySelectorAll('.mm-bar')].map((el) => ({
      prepend: (el.querySelector('.el-input-group__prepend')?.textContent || '').trim(),
      inputW: Math.round(el.querySelector('input')?.getBoundingClientRect().width || 0),
      groupW: Math.round(el.querySelector('.el-input')?.getBoundingClientRect().width || 0),
      buttons: [...el.querySelectorAll('button')].map((b) => (b.textContent || '').trim()),
    }))
    return { locale: localStorage.getItem('mes_locale'), bars, docOverflowX: document.documentElement.scrollWidth > window.innerWidth }
  })
  await page.screenshot({ path: shot })
  return info
}

console.log('EN:', JSON.stringify(await check('en', 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/30-two-bars-en.png')))
console.log('JA:', JSON.stringify(await check('ja', 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/31-two-bars-ja.png')))
await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: 'all' })
