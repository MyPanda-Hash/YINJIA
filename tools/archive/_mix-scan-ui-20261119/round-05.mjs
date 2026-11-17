// 扫码混料 终验(2026-11-19):
//   A. 注入 YjNative 假壳 → 页面出现「扫码」按钮(与生产领料同一判定)
//   B. 点「扫码」→ 走 window.YjNative.scan() → __yjScanResult 回传 → 自动查询工单与物料清单
//      (旧实现这里会抛 "This plugin method is not available on this platform.")
//   C. 版面:工单行/物料行都是「输入框 + 按钮」一行,手机 390 宽也不换行;取秤提交在电子秤卡里
const task = await taskSpace('mix-scan-verify-20261119b')
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

// 趁登录态还在,挑一张「产品有物料清单」的真实工单
const pick = await page.evaluate(async () => {
  const token = (localStorage.getItem('mes_token') || '').replace(/^"|"$/g, '')
  const h = token ? { Authorization: 'Bearer ' + token } : {}
  const j = async (u) => {
    const r = await fetch(u, { headers: h })
    return r.ok ? r.json() : { __status: r.status }
  }
  const ros = await j('/api/px/pick/create/woStatus?keyword=')
  const rows = (ros.data && (ros.data.list || ros.data.rows)) || ros.list || []
  const cands = rows.filter((r) => Number(r['排产数量']) > 0 && r['工单号']).slice(0, 40)
  for (const r of cands) {
    const pc = encodeURIComponent(String(r['产品编号'] || '').trim())
    if (!pc) continue
    const bom = await j('/api/px/mix/bom?productCode=' + pc)
    const list = (bom.data && (bom.data.list || bom.data.rows)) || bom.list || []
    if (list.length) {
      return { orderNo: String(r['工单号']), lineNo: Number(r['工单行号']) || 0, product: r['产品编号'], productName: r['产品名称'], bomCount: list.length, rowsTotal: rows.length, cands: cands.length }
    }
  }
  return { found: false, rows: rows.length, cands: cands.length, sample: cands.slice(0, 3) }
})
console.log('工单取样:', JSON.stringify(pick))

const code = pick.orderNo ? `YJ@${pick.orderNo}@${1000 + (pick.lineNo || 0)}` : 'YJ@GD-NOT-EXIST@1001'
console.log('mockCode =', code)

await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.waitForTimeout(600)

const before = await page.evaluate(() => ({
  hasBridge: !!(window.YjNative && window.YjNative.scan),
  barButtons: [...document.querySelectorAll('.mm-bar button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()),
  camLongButton: [...document.querySelectorAll('button')].some((b) => /相机扫码/.test((b.textContent || ''))),
}))
console.log('点之前:', JSON.stringify(before))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/05-mobile-before-scan.png' })

// 点「工单行」那颗扫码按钮(.mm-bar 内最后一颗)
await page.evaluate((c) => { window.__mockCode = c }, code)
await page.click('.mm-bar button:last-of-type', { label: '点击工单扫码' })
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
console.log('扫工单后:', JSON.stringify(afterWo, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/06-mobile-order-loaded.png' })

// 再扫一个物料码(编码|批号),确认走同一条桥、并累加成「已记」
const matCode = (afterWo.bomRows[0] || '').split(' ')[0]
console.log('准备扫物料:', matCode)
await page.evaluate((c) => { window.__mockCode = c }, matCode ? matCode + '|20261101' : '')
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
  firstRow: (document.querySelector('.mm-list .mm-row')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
}))
console.log('扫物料后:', JSON.stringify(afterMat, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/07-mobile-after-material.png' })

const plug = [...afterWo.alerts, ...afterMat.alerts].some((t) => /plugin method|not available on this platform/i.test(t))
console.log('=== 结论 ===')
console.log(JSON.stringify({
  bridgeExposed: before.hasBridge,
  oldCamLongButtonGone: !before.camLongButton,
  scanBridgeCalledTimes: afterMat.scanCalls,
  inputFilledByScan: afterWo.inputValue === code,
  pluginErrorGone: !plug,
  orderLoaded: afterWo.hasOrder,
  bomLineCount: afterWo.bomRows.length,
  allBarsSingleRow: afterWo.bars.every((b) => b.singleRow),
  scaleCardText: afterWo.scaleCard,
}, null, 2))

await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: 'all' })
