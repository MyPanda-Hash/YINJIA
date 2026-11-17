// 鎵爜娣锋枡 缁堥獙(2026-11-19):
//   A. 娉ㄥ叆 YjNative 鍋囧３ 鈫?椤甸潰鍑虹幇銆屾壂鐮併€嶆寜閽?涓庣敓浜ч鏂欏悓涓€鍒ゅ畾)
//   B. 鐐广€屾壂鐮併€嶁啋 璧?window.YjNative.scan() 鈫?__yjScanResult 鍥炰紶 鈫?鑷姩鏌ヨ宸ュ崟涓庣墿鏂欐竻鍗?//      (鏃у疄鐜拌繖閲屼細鎶?"This plugin method is not available on this platform.")
//   C. 鐗堥潰:宸ュ崟琛?鐗╂枡琛岄兘鏄€岃緭鍏ユ + 鎸夐挳銆嶄竴琛?鎵嬫満 390 瀹戒篃涓嶆崲琛?鍙栫Г鎻愪氦鍦ㄧ數瀛愮Г鍗￠噷
const task = await taskSpace('mix-scan-verify-20261119')
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
      }, 300)
    },
    getBaseUrl: function () { return 'http://localhost:5173' }
  }
`
await page.cdp('Page.addScriptToEvaluateOnNewDocument', { source: STUB })
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 60000 })
await page.reload()
await page.waitForTimeout(5000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

// 瓒佺櫥褰曟€佽繕鍦?鎸戜竴寮犮€屼骇鍝佹湁鐗╂枡娓呭崟銆嶇殑鐪熷疄宸ュ崟
const pick = await page.evaluate(async () => {
  const token = (localStorage.getItem('mes_token') || '').replace(/^"|"$/g, '')
  const h = token ? { Authorization: 'Bearer ' + token } : {}
  const j = async (u) => {
    const r = await fetch(u, { headers: h })
    return r.ok ? r.json() : { __status: r.status }
  }
  const ros = await j('/api/px/pick/create/woStatus?keyword=')
  const rows = (ros.data && (ros.data.list || ros.data.rows)) || ros.list || []
  const cands = rows.filter((r) => Number(r['鎺掍骇鏁伴噺']) > 0 && r['宸ュ崟鍙?]).slice(0, 40)
  for (const r of cands) {
    const pc = encodeURIComponent(String(r['浜у搧缂栧彿'] || '').trim())
    if (!pc) continue
    const bom = await j('/api/px/mix/bom?productCode=' + pc)
    const list = (bom.data && (bom.data.list || bom.data.rows)) || bom.list || []
    if (list.length) {
      return { orderNo: String(r['宸ュ崟鍙?]), lineNo: Number(r['宸ュ崟琛屽彿']) || 0, product: r['浜у搧缂栧彿'], productName: r['浜у搧鍚嶇О'], bomCount: list.length, rowsScanned: cands.length }
    }
  }
  return { found: false, rows: rows.length, cands: cands.length }
})
console.log('宸ュ崟鍙栨牱:', JSON.stringify(pick))

const code = pick.orderNo ? `YJ@${pick.orderNo}@${1000 + (pick.lineNo || 0)}` : 'YJ@GD-NOT-EXIST@1001'
console.log('mockCode =', code)

await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.waitForTimeout(600)

const before = await page.evaluate(() => ({
  hasBridge: !!(window.YjNative && window.YjNative.scan),
  barButtons: [...document.querySelectorAll('.mm-bar button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()),
  camLongButton: [...document.querySelectorAll('button')].some((b) => /鐩告満鎵爜/.test((b.textContent || ''))),
}))
console.log('鐐逛箣鍓?', JSON.stringify(before))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/05-mobile-before-scan.png' })

// 鐐广€屽伐鍗曡銆嶉偅棰楁壂鐮佹寜閽?DOM 閲?.mm-bar 鍐呯 2 棰楁寜閽?
await page.evaluate((c) => { window.__mockCode = c }, code)
await page.click('.mm-bar button:last-of-type', { label: '鐐瑰嚮宸ュ崟鎵爜' })
await page.waitForTimeout(4000)

const afterWo = await page.evaluate(() => ({
  scanCalls: window.__scanCalls,
  inputValue: (document.querySelector('.mm-bar input') || {}).value || '',
  alerts: [...document.querySelectorAll('.el-alert__title')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  hasOrder: !!document.querySelector('.mm-card'),
  orderText: (document.querySelector('.mm-card')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140),
  bomRows: [...document.querySelectorAll('.mm-list .mm-row')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70)),
  scaleCard: (document.querySelector('.mm-scale')?.textContent || '').replace(/\s+/g, ' ').trim(),
  bars: [...document.querySelectorAll('.mm-bar')].map((el) => {
    const kids = [...el.children].map((c) => {
      const r = c.getBoundingClientRect()
      return { text: (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'input', top: Math.round(r.top), h: Math.round(r.height) }
    })
    return {
      singleRow: kids.length > 1 ? Math.max(...kids.map((k) => k.top)) - Math.min(...kids.map((k) => k.top)) < 4 : true,
      kids,
    }
  }),
}))
console.log('鎵伐鍗曞悗:', JSON.stringify(afterWo, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/06-mobile-order-loaded.png', fullPage: true })

// 鍐嶆壂涓€涓墿鏂欑爜(code|batch),纭璧板悓涓€鏉℃ˉ銆佸苟鎶婄Г鍊?鎵嬭緭鏁伴噺钀芥垚銆屽凡璁般€?const matCode = (afterWo.bomRows[0] || '').split(' ')[0]
console.log('鍑嗗鎵墿鏂?', matCode)
await page.evaluate((c) => { window.__mockCode = c }, matCode ? matCode + '|20261101' : '')
const matScanBtn = '.mm-bar:nth-of-type(2) button:last-of-type'
await page.evaluate(() => {
  const bars = [...document.querySelectorAll('.mm-bar')]
  const b = bars[bars.length - 1]
  const btn = [...b.querySelectorAll('button')].pop()
  if (btn) btn.click()
})
await page.waitForTimeout(3500)
const afterMat = await page.evaluate(() => ({
  scanCalls: window.__scanCalls,
  alerts: [...document.querySelectorAll('.el-alert__title')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  okText: (document.querySelector('.el-alert--success .el-alert__title')?.textContent || '').trim(),
}))
console.log('鎵墿鏂欏悗:', JSON.stringify(afterMat, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/07-mobile-after-material.png', fullPage: true })

const plug = [...afterWo.alerts, ...afterMat.alerts].some((t) => /plugin method|not available on this platform/i.test(t))
console.log('=== 缁撹 ===')
console.log(JSON.stringify({
  bridgeExposed: before.hasBridge,
  oldCamLongButtonGone: !before.camLongButton,
  scanBridgeCalledTimes: afterMat.scanCalls,
  inputFilledByScan: afterWo.inputValue === code,
  pluginErrorGone: !plug,
  orderLoaded: afterWo.hasOrder,
  bomLineCount: afterWo.bomRows.length,
  allBarsSingleRow: afterWo.bars.every((b) => b.singleRow),
}, null, 2))

await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: 'all' })
