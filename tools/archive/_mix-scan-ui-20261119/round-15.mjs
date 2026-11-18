// 2026-11-17 第三批 · 重跑(new space):两栏版面 + 栏② 模糊查
const task = await taskSpace('mix-scan-fuzzybar-20261117b')
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
await page.cdp('Page.addScriptToEvaluateOnNewDocument', { source: STUB })
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 60000 })
await page.reload()
await page.waitForTimeout(6000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(300)
} catch (e) { console.log('restore skip: ' + e.message) }

await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.waitForTimeout(600)

const barsNow = await page.evaluate(() => [...document.querySelectorAll('.mm-bar')].map((el, i) => ({
  i,
  prepend: (el.querySelector('.el-input-group__prepend')?.textContent || '').trim(),
  buttons: [...el.querySelectorAll('button')].map((b) => (b.textContent || '').trim()),
  placeholder: el.querySelector('input')?.placeholder || '',
})))
console.log('两栏:', JSON.stringify(barsNow, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/27-two-bars.png' })

// 栏②(索引 1)填 0015 → 点它的「查询」
await page.evaluate(() => {
  const bar = document.querySelectorAll('.mm-bar')[1]
  const inp = bar.querySelector('input')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, '0015')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await page.waitForTimeout(400)
await page.evaluate(() => {
  const bar = document.querySelectorAll('.mm-bar')[1]
  const btn = [...bar.querySelectorAll('button')][0]
  if (btn) btn.click()
})
await page.waitForTimeout(4500)
const out = await page.evaluate(() => ({
  hash: location.hash,
  alerts: [...document.querySelectorAll('.el-alert__title')].map((e) => (e.textContent || '').trim()),
  candRows: [...document.querySelectorAll('.mm-cand-row')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  barCount: document.querySelectorAll('.mm-bar').length,
  inputs: [...document.querySelectorAll('.mm-bar input')].map((i) => i.value),
}))
console.log('栏② 查询后:', JSON.stringify(out, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/28-bar2-fuzzy.png' })

// 点候选
const picked = await page.evaluate(async () => {
  const row = document.querySelector('.mm-cand-row')
  if (!row) return { clicked: false }
  row.click()
  await new Promise((r) => setTimeout(r, 2500))
  return {
    clicked: true,
    orderText: (document.querySelector('.mm-card')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90),
    candGone: !document.querySelector('.mm-cand-row'),
    bomLines: document.querySelectorAll('.mm-list .mm-row').length,
  }
})
console.log('点候选后:', JSON.stringify(picked, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/29-after-pick.png' })

console.log('=== 结论 ===')
console.log(JSON.stringify({
  barCount: barsNow.length,
  bar1: barsNow[0],
  bar2: barsNow[1],
  fuzzyCandidates: out.candRows.length,
  fuzzyFirstRow: out.candRows[0],
  picked: picked,
}, null, 2))

await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: 'all' })
