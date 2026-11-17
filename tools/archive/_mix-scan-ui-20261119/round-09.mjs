// 2026-11-17 第二批走查:
//   A. 扫码混料「模糊查询」:敲工单号片段(如 0015)或产品名片段(如 烧结)→ 候选工单行列表;
//      点候选 → 载入工单 + 物料清单。
//   B. 其他领料 / 其他退料:有「扫码」按钮;点它 → 走 window.YjNative.scan() → 回传物料码 → 自动查库存。
const task = await taskSpace('mix-scan-fuzzy-20261117')
const page = task.page('p1')

const STUB = `
  window.__scanCalls = 0
  window.__mockCode = ''
  window.YjNative = {
    scan: function () {
      window.__scanCalls += 1
      var code = window.__mockCode
      setTimeout(function () { if (window.__yjScanResult) window.__yjScanResult(code, !!code) }, 200)
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

await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.waitForTimeout(500)

// ── A. 模糊查询:敲产品名片段「烧结」──
async function typeAndSearch(text) {
  await page.evaluate((t) => {
    const inp = document.querySelector('.mm-bar input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, t)
    inp.dispatchEvent(new Event('input', { bubbles: true }))
  }, text)
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.mm-bar button')]
    if (btns[0]) btns[0].click()
  })
  await page.waitForTimeout(3500)
  return page.evaluate(() => ({
    placeholder: document.querySelector('.mm-bar input')?.placeholder || '',
    candRows: [...document.querySelectorAll('.mm-cand-row')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
    candTip: (document.querySelector('.mm-cand-tip')?.textContent || '').trim(),
    alerts: [...document.querySelectorAll('.el-alert__title')].map((e) => (e.textContent || '').trim()),
    orderText: (document.querySelector('.mm-card')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100),
  }))
}

const byName = await typeAndSearch('烧结')
console.log('模糊查(烧结):', JSON.stringify(byName, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/16-fuzzy-by-name.png' })

const byNo = await typeAndSearch('0015')
console.log('模糊查(0015):', JSON.stringify(byNo, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/17-fuzzy-by-no.png' })

// 点第一条候选
const picked = await page.evaluate(async () => {
  const row = document.querySelector('.mm-cand-row')
  if (!row) return { clicked: false }
  row.click()
  await new Promise((r) => setTimeout(r, 2500))
  return {
    clicked: true,
    orderText: (document.querySelector('.mm-card')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100),
    bom: [...document.querySelectorAll('.mm-list .mm-row')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50)),
    candGone: !document.querySelector('.mm-cand-row'),
  }
})
console.log('点候选后:', JSON.stringify(picked, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/18-after-pick.png' })

// ── B. 其他领料 / 其他退料:扫码按钮 ──
async function checkOther(url, label, shot, matCode) {
  await page.goto(url, { timeout: 60000 })
  await page.waitForTimeout(4500)
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  await page.waitForTimeout(500)
  const before = await page.evaluate(() => ({
    scanbarButtons: [...document.querySelectorAll('.mo-scanbar button')].map((b) => (b.textContent || '').trim()),
    inputPlaceholder: document.querySelector('.mo-scanbar input')?.placeholder || '',
    bridge: !!(window.YjNative && window.YjNative.scan),
  }))
  await page.evaluate((c) => { window.__mockCode = c }, matCode)
  // 点「扫码」(最后一颗)
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.mo-scanbar button')]
    if (btns.length) btns[btns.length - 1].click()
  })
  await page.waitForTimeout(4000)
  const after = await page.evaluate(() => ({
    scanCalls: window.__scanCalls,
    scanText: document.querySelector('.mo-scanbar input')?.value || '',
    alerts: [...document.querySelectorAll('.el-alert__title')].map((e) => (e.textContent || '').trim()),
    cands: [...document.querySelectorAll('.mo-cand-name')].map((e) => (e.textContent || '').trim()),
  }))
  await page.screenshot({ path: shot })
  return { label, before, after }
}

const pick = await checkOther('http://localhost:5173/#/panelx/list/MOBILE_OTHER_PICK', '其他领料',
  'C:/Users/Lenovo/ego/mix-scan-ui-20261119/19-other-pick-scan.png', 'YJ-TJHZ-001|20261101')
console.log('其他领料:', JSON.stringify(pick, null, 2))

const ret = await checkOther('http://localhost:5173/#/panelx/list/MOBILE_OTHER_RET', '其他退料',
  'C:/Users/Lenovo/ego/mix-scan-ui-20261119/20-other-ret-scan.png', 'YJ-TJHZ-001|20261101')
console.log('其他退料:', JSON.stringify(ret, null, 2))

console.log('=== 结论 ===')
console.log(JSON.stringify({
  fuzzyPlaceholder: byName.placeholder,
  fuzzyCandidateRows: byName.candRows.length,
  fuzzyCandidateShowNo: byNo.candRows.length,
  pickLoadedOrder: !!picked.orderText,
  pickBomLines: picked.bom.length,
  otherPickScanBtn: pick.before.scanbarButtons,
  otherPickScanCalled: pick.after.scanCalls,
  otherPickCands: pick.after.cands.length,
  otherRetScanBtn: ret.before.scanbarButtons,
  otherRetScanCalled: ret.after.scanCalls,
  otherRetCands: ret.after.cands.length,
}, null, 2))

await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: 'all' })
