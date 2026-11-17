// 扫码混料 终验(2026-11-17 收尾):中文 390 宽 + 英文 390 宽各一张,确认版面与译名
const task = await taskSpace('mix-scan-verify-20261117d')
const page = task.page('p1')

const STUB = `
  window.__scanCalls = 0
  window.__mockCode = ''
  window.YjNative = {
    scan: function () {
      window.__scanCalls += 1
      var code = window.__mockCode
      setTimeout(function () {
        if (window.__yjScanResult) window.__yjScanResult(code, !!code)
      }, 200)
    },
    getBaseUrl: function () { return 'http://localhost:5173' }
  }
`
const WO_CODE = 'YJ@GD-2026-11-0015@1001'

await page.cdp('Page.addScriptToEvaluateOnNewDocument', { source: STUB })
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 60000 })
await page.reload()
await page.waitForTimeout(5000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.waitForTimeout(500)

// 中文:扫工单 → 版面
await page.evaluate((c) => { window.__mockCode = c }, WO_CODE)
await page.click('.mm-bar button:last-of-type', { label: '点击工单扫码' })
await page.waitForTimeout(3500)
const zh = await page.evaluate(() => ({
  title: (document.querySelector('.mm-title')?.textContent || '').trim(),
  sub: (document.querySelector('.mm-sub')?.textContent || '').trim(),
  bars: [...document.querySelectorAll('.mm-bar')].map((el) => [...el.children].map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim() || 'input')),
  bom: [...document.querySelectorAll('.mm-list .mm-row')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50)),
  scale: (document.querySelector('.mm-scale')?.textContent || '').replace(/\s+/g, ' ').trim(),
  alerts: [...document.querySelectorAll('.el-alert__title')].map((e) => (e.textContent || '').trim()),
}))
console.log('中文:', JSON.stringify(zh, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/11-mobile-zh.png' })

// 英文:切语言再走一遍同样的扫码
await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.reload()
await page.waitForTimeout(5000)
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.waitForTimeout(600)
await page.evaluate((c) => { window.__mockCode = c }, WO_CODE)
await page.click('.mm-bar button:last-of-type', { label: '点击工单扫码 (EN)' })
await page.waitForTimeout(3500)
const en = await page.evaluate(() => ({
  title: (document.querySelector('.mm-title')?.textContent || '').trim(),
  sub: (document.querySelector('.mm-sub')?.textContent || '').trim(),
  bars: [...document.querySelectorAll('.mm-bar')].map((el) => [...el.children].map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim() || 'input')),
  bom: [...document.querySelectorAll('.mm-list .mm-row')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)),
  scale: (document.querySelector('.mm-scale')?.textContent || '').replace(/\s+/g, ' ').trim(),
  emptyLabel: (document.querySelector('.mm-list-head')?.textContent || '').replace(/\s+/g, ' ').trim(),
  stillChinese: [...document.querySelectorAll('.mm-scan *')]
    .filter((e) => e.children.length === 0)
    .map((e) => (e.textContent || '').trim())
    .filter((t) => /[\u4e00-\u9fa5]/.test(t) && !/GD-2026|YJ-|A-45|成型/.test(t)),
}))
console.log('英文:', JSON.stringify(en, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/12-mobile-en.png' })

// 还原成中文,别让下次进来是英文
await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: 'all' })
