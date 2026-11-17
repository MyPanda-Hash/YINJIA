// 最终走查(2026-11-17):中文/英文 390 宽各一张,确认「取秤提交」不再被截断、工单行标签不换行
const task = await taskSpace('mix-scan-verify-20261117e')
const page = task.page('p1')

const STUB = `
  window.__mockCode = ''
  window.YjNative = {
    scan: function () {
      var code = window.__mockCode
      setTimeout(function () { if (window.__yjScanResult) window.__yjScanResult(code, !!code) }, 200)
    },
    getBaseUrl: function () { return 'http://localhost:5173' }
  }
`
const WO_CODE = 'YJ@GD-2026-11-0015@1001'

async function loadAndScan(locale, shot) {
  await page.evaluate((l) => localStorage.setItem('mes_locale', l), locale)
  await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 60000 })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  await page.waitForTimeout(600)
  await page.evaluate((c) => { window.__mockCode = c }, WO_CODE)
  await page.click('.mm-bar button:last-of-type', { label: '点击工单扫码 ' + locale })
  await page.waitForTimeout(3500)
  const info = await page.evaluate(() => {
    const inView = (el) => {
      const r = el.getBoundingClientRect()
      return { right: Math.round(r.right), overflow: r.right > window.innerWidth - 4 }
    }
    const btn = [...document.querySelectorAll('.mm-scale-manual button')].pop()
    return {
      viewportW: window.innerWidth,
      takeBtn: btn ? { text: (btn.textContent || '').trim(), ...inView(btn) } : null,
      barButtons: [...document.querySelectorAll('.mm-bar')].map((el) => [...el.children].map((c) => (c.textContent || '').trim() || 'input')),
      tagLine: (document.querySelector('.mm-tag')?.textContent || '').trim(),
      docOverflowX: document.documentElement.scrollWidth > window.innerWidth,
    }
  })
  await page.screenshot({ path: shot })
  return info
}

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }
await page.cdp('Page.addScriptToEvaluateOnNewDocument', { source: STUB })

const zh = await loadAndScan('zh-CN', 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/13-final-zh.png')
console.log('中文:', JSON.stringify(zh))
const en = await loadAndScan('en', 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/14-final-en.png')
console.log('英文:', JSON.stringify(en))
const ja = await loadAndScan('ja', 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/15-final-ja.png')
console.log('日文:', JSON.stringify(ja))

await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: 'all' })
