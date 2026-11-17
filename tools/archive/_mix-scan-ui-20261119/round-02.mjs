// 扫码混料 · 相机扫码链路验证(2026-11-19)
// 目的:证明「扫码」按钮走的是 window.YjNative.scan() 桥(与生产领料同一条调用),
//      而不是原来那套 ML Kit 插件;点击后不再出现
//      "This plugin method is not available on this platform."
const task = await taskSpace('mix-scan-ui-20261119')
const page = task.page('p1')

// ① 在页面加载前注入"假壳",模拟手机 App 的 YjNative + 扫码回传
await page.cdp('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__scanCalls = 0
    window.__mockCode = ''
    window.YjNative = {
      scan: function () {
        window.__scanCalls += 1
        var code = window.__mockCode
        setTimeout(function () {
          if (window.__yjScanResult) window.__yjScanResult(code, !!code)
        }, 300)
      },
      getBaseUrl: function () { return 'http://localhost:5173' }
    }
  `,
})

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 60000 })
await page.waitForTimeout(4000)

// 会话过期则自动登录(注入脚本对新文档同样生效)
if (!(await page.evaluate(() => !!document.querySelector('.mm-scan')))) {
  console.log('需要登录,执行自动登录')
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
  await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 60000 })
  await page.waitForTimeout(4000)
}

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  }
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

// ② 取一张真实工单(工单号 + 行号),拼成现场用的工单码
const wo = await page.evaluate(async () => {
  const r = await fetch('/api/px/pick/create/woStatus?keyword=', { credentials: 'include' })
  if (!r.ok) return { err: r.status }
  const j = await r.json()
  const rows = (j && (j.data?.list || j.list || j.data?.rows)) || []
  return { n: rows.length, first: rows[0] || null }
})
console.log('真实工单取样:', JSON.stringify(wo).slice(0, 400))
const row = wo.first || {}
const orderNo = String(row['工单号'] || '').trim()
const lineNo = Number(row['工单行号']) || 0
const mockCode = orderNo ? `YJ@${orderNo}@${1000 + lineNo}` : 'YJ@GD-NOT-EXIST@1001'
console.log('mockCode =', mockCode)

// ③ 断言:有桥 ⇒ 出现「扫码」按钮,且没有旧的长条「相机扫码」按钮
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.waitForTimeout(600)
const before = await page.evaluate(() => ({
  buttons: [...document.querySelectorAll('.mm-bar button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()),
  hasBridge: !!(window.YjNative && window.YjNative.scan),
  scanCalls: window.__scanCalls,
}))
console.log('点之前:', JSON.stringify(before, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/03-mobile-with-bridge.png' })

// ④ 点「扫码」→ 自动填码并查询
await page.evaluate((code) => { window.__mockCode = code }, mockCode)
const scanBtn = page  // 占位,便于阅读
await page.click('.mm-bar button:nth-of-type(2)', { label: '点击工单行的扫码按钮' })
await page.waitForTimeout(4000)

const after = await page.evaluate(() => ({
  scanCalls: window.__scanCalls,
  inputValue: (document.querySelector('.mm-bar input') || {}).value || '',
  alerts: [...document.querySelectorAll('.el-alert__title')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  hasOrder: !!document.querySelector('.mm-card'),
  orderText: (document.querySelector('.mm-card')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
  boms: [...document.querySelectorAll('.mm-list .mm-row')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)),
  empty: (document.querySelector('.mm-list .el-empty__description')?.textContent || '').trim(),
  buttons: [...document.querySelectorAll('.mm-bar button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()),
}))
console.log('点之后:', JSON.stringify(after, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/04-mobile-after-scan.png' })

const pluginErr = after.alerts.some((t) => /plugin method|not available on this platform/i.test(t))
console.log('结论:', JSON.stringify({
  scanBridgeCalled: after.scanCalls === 1,
  inputFilled: after.inputValue === mockCode,
  pluginErrorGone: !pluginErr,
}))

await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: 'all' })
