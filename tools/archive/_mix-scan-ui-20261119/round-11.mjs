// 探针:抓页面里 axios(XHR) 的 5xx 响应体,定位「模糊查询 500」的真实原因
const task = await taskSpace('mix-scan-fuzzy-20261117b')
const page = task.page('p1')

const STUB = `
  window.__xhrLog = []
  window.__mockCode = ''
  window.YjNative = {
    scan: function () {
      var code = window.__mockCode
      setTimeout(function () { if (window.__yjScanResult) window.__yjScanResult(code, !!code) }, 200)
    },
    getBaseUrl: function () { return 'http://localhost:5173' }
  }
  ;(function () {
    var open = XMLHttpRequest.prototype.open
    var send = XMLHttpRequest.prototype.send
    XMLHttpRequest.prototype.open = function (m, u) { this.__u = m + ' ' + u; return open.apply(this, arguments) }
    XMLHttpRequest.prototype.send = function () {
      var xhr = this
      xhr.addEventListener('loadend', function () {
        if (xhr.status >= 400) {
          window.__xhrLog.push({ url: xhr.__u, status: xhr.status, body: String(xhr.responseText || '').slice(0, 600) })
        }
      })
      return send.apply(this, arguments)
    }
  })()
`
await page.cdp('Page.addScriptToEvaluateOnNewDocument', { source: STUB })
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 60000 })
await page.reload()
await page.waitForTimeout(5000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }

await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.waitForTimeout(500)

await page.evaluate(() => {
  const inp = document.querySelector('.mm-bar input')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, '0015')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.mm-bar button')]
  if (btns[0]) btns[0].click()
})
await page.waitForTimeout(4000)
const log = await page.evaluate(() => ({ xhr: window.__xhrLog, alerts: [...document.querySelectorAll('.el-alert__title')].map((e) => (e.textContent || '').trim()) }))
console.log(JSON.stringify(log, null, 2))

// 顺手把 其他领料 的 500 也抓一下
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_OTHER_PICK', { timeout: 60000 })
await page.waitForTimeout(4500)
await page.evaluate(() => { window.__xhrLog = [] })
await page.evaluate(() => {
  const inp = document.querySelector('.mo-scanbar input')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, 'YJ-TJHZ-001|20261101')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.mo-scanbar button')]
  if (btns[0]) btns[0].click()
})
await page.waitForTimeout(4000)
const log2 = await page.evaluate(() => ({ xhr: window.__xhrLog, alerts: [...document.querySelectorAll('.el-alert__title')].map((e) => (e.textContent || '').trim()) }))
console.log(JSON.stringify(log2, null, 2))

await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: 'all' })
