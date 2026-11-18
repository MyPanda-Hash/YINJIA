// 扫码混料 走查(2026-11-19 第二轮):载入真实工单(YJ_TEST:GD-2026-11-0015#1 / 产品 A-45-01),
// 看物料清单、电子秤卡(含「取秤提交」)、扫码行单行布局,并走一次「手输数量 + 提交本笔」。
const task = await taskSpace('mix-scan-verify-20261119c')
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
const MAT_CODE = 'YJ-TJHZ-001|20261101'

await page.cdp('Page.addScriptToEvaluateOnNewDocument', { source: STUB })
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 60000 })
await page.reload()
await page.waitForTimeout(5000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

// ① 手机竖屏:点「扫码」扫工单
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.waitForTimeout(500)
await page.evaluate((c) => { window.__mockCode = c }, WO_CODE)
await page.click('.mm-bar button:last-of-type', { label: '点击工单扫码' })
await page.waitForTimeout(4000)

const s1 = await page.evaluate(() => ({
  scanCalls: window.__scanCalls,
  alerts: [...document.querySelectorAll('.el-alert__title')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  orderText: (document.querySelector('.mm-card')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
  bomRows: [...document.querySelectorAll('.mm-list .mm-row')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70)),
  scaleText: (document.querySelector('.mm-scale')?.textContent || '').replace(/\s+/g, ' ').trim(),
  bars: [...document.querySelectorAll('.mm-bar')].map((el) => {
    const kids = [...el.children].map((c) => {
      const r = c.getBoundingClientRect()
      return { text: (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 14) || 'input', top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) }
    })
    return { singleRow: kids.length > 1 ? Math.max(...kids.map((k) => k.top)) - Math.min(...kids.map((k) => k.top)) < 4 : true, kids }
  }),
  footBtn: (document.querySelector('.mm-foot-btn')?.textContent || '').trim(),
}))
console.log('扫工单后(390 宽):', JSON.stringify(s1, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/08-mobile-order.png' })

// ② 手输数量 + 提交本笔(秤离线时的兜底路径,同时验证「取秤提交」按钮在秤卡里)
await page.evaluate(() => {
  const inp = document.querySelector('.mm-scale-manual input')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, '12.5')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.dispatchEvent(new Event('blur', { bubbles: true }))
})
await page.waitForTimeout(600)
const takeBtn = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.mm-scale-manual button')]
  return btns.map((b) => ({ text: (b.textContent || '').trim(), disabled: b.disabled }))
})
console.log('秤卡按钮:', JSON.stringify(takeBtn))
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.mm-scale-manual button')].pop()
  if (b) b.click()
})
await page.waitForTimeout(3000)
const s2 = await page.evaluate(() => ({
  alerts: [...document.querySelectorAll('.el-alert__title')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  okAlerts: [...document.querySelectorAll('.el-alert--success .el-alert__title')].map((e) => (e.textContent || '').trim()),
  firstRow: (document.querySelector('.mm-list .mm-row')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90),
  footInfo: (document.querySelector('.mm-foot-info')?.textContent || '').replace(/\s+/g, ' ').trim(),
}))
console.log('提交本笔后:', JSON.stringify(s2, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/09-mobile-after-submit.png' })

// ③ 桌面宽屏版面
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await page.waitForTimeout(800)
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/10-desktop-order.png' })

const barRows = s1.bars.every((b) => b.singleRow)
const plug = s1.alerts.some((t) => /plugin method|not available/i.test(t))
console.log('=== 结论 ===')
console.log(JSON.stringify({
  orderLoaded: !!s1.orderText,
  bomLineCount: s1.bomRows.length,
  barsSingleRow: barRows,
  bar1Buttons: s1.bars[0] && s1.bars[0].kids.map((k) => k.text),
  bar2Buttons: s1.bars[1] && s1.bars[1].kids.map((k) => k.text),
  scaleCardHasTakeWeight: /取秤提交/.test(s1.scaleText),
  scaleCard: s1.scaleText,
  submitRecorded: (s2.okAlerts || []).length > 0,
  submitOkText: s2.okAlerts,
  pluginErrorGone: !plug,
}, null, 2))

await task.finish({ keep: 'all' })
