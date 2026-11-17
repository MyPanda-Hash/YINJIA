// 2026-11-17 第三批走查:扫码混料「模糊查询单独一栏」
//   栏① = 扫工单码 / 输入单据号(精确);栏② = 模糊查询(前缀「模糊查询」)
//   A. 两栏都在,各有自己的 placeholder/前缀,版面单行不换行
//   B. 栏① 敲中文产品名「烧结」→ 指路到下面的模糊查询(不报"不是工单码")
//   C. 栏① 敲完整工单号 GD-2026-11-0015 → 精确载入工单
//   D. 栏② 敲 0015 → 候选列表 → 点候选载入
const task = await taskSpace('mix-scan-fuzzybar-20261117')
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
await page.waitForTimeout(5000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(300)
} catch (e) { console.log('restore skip: ' + e.message) }

await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.waitForTimeout(500)

const bars = async () => page.evaluate(() => {
  return [...document.querySelectorAll('.mm-bar')].map((el, i) => {
    const kids = [...el.children].map((c) => {
      const r = c.getBoundingClientRect()
      return {
        text: (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 20) || 'input',
        placeholder: c.querySelector ? (c.querySelector('input')?.placeholder || '') : '',
        top: Math.round(r.top),
        h: Math.round(r.height),
        w: Math.round(r.width),
      }
    })
    return {
      i,
      prepend: (el.querySelector('.el-input-group__prepend')?.textContent || '').trim(),
      singleRow: kids.length > 1 ? Math.max(...kids.map((k) => k.top)) - Math.min(...kids.map((k) => k.top)) < 4 : true,
      overflowX: kids.some((k) => k.top !== kids[0].top && false),
      kids,
    }
  })
})

const initial = await bars()
console.log('初始两栏:', JSON.stringify(initial, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/21-two-bars.png' })

/** 在第 idx 个 .mm-bar 的输入框里填字,并点该栏第 btnIdx 颗按钮 */
async function fillAndClick(barIdx, text, btnIdx) {
  await page.evaluate(({ barIdx, text }) => {
    const bar = document.querySelectorAll('.mm-bar')[barIdx]
    const inp = bar.querySelector('input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, text)
    inp.dispatchEvent(new Event('input', { bubbles: true }))
  }, { barIdx, text })
  await page.evaluate(({ barIdx, btnIdx }) => {
    const bar = document.querySelectorAll('.mm-bar')[barIdx]
    const btns = [...bar.querySelectorAll('button')]
    if (btns[btnIdx]) btns[btnIdx].click()
  }, { barIdx, btnIdx })
  await page.waitForTimeout(3500)
  return page.evaluate(() => ({
    alerts: [...document.querySelectorAll('.el-alert__title')].map((e) => (e.textContent || '').trim()),
    candRows: [...document.querySelectorAll('.mm-cand-row')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
    orderText: (document.querySelector('.mm-card')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90),
    bom: [...document.querySelectorAll('.mm-list .mm-row')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)),
  }))
}

// B. 栏① 敲中文产品名 → 指路
const b = await fillAndClick(0, '烧结', 0)
console.log('栏① 敲「烧结」:', JSON.stringify(b, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/22-bar1-chinese-hint.png' })

// C. 栏① 敲完整工单号 → 精确载入
const c = await fillAndClick(0, 'GD-2026-11-0015', 0)
console.log('栏① 敲完整工单号:', JSON.stringify(c, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/23-bar1-exact-order.png' })

// D. 栏② 模糊查 0015 → 候选 → 点第一条
const d = await fillAndClick(1, '0015', 0)
console.log('栏② 模糊查 0015:', JSON.stringify(d, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/24-bar2-fuzzy-cands.png' })

const picked = await page.evaluate(async () => {
  const row = document.querySelector('.mm-cand-row')
  if (!row) return { clicked: false }
  row.click()
  await new Promise((r) => setTimeout(r, 2500))
  return {
    clicked: true,
    orderText: (document.querySelector('.mm-card')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90),
    candGone: !document.querySelector('.mm-cand-row'),
  }
})
console.log('点候选后:', JSON.stringify(picked, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/25-after-pick.png' })

const after = await bars()
console.log('=== 结论 ===')
console.log(JSON.stringify({
  barCountInitial: initial.length,
  bar1: initial[0] && { placeholder: initial[0].kids[0].placeholder, buttons: initial[0].kids.map((k) => k.text), singleRow: initial[0].singleRow },
  bar2: initial[1] && { prepend: initial[1].prepend, placeholder: initial[1].kids[0].placeholder, buttons: initial[1].kids.map((k) => k.text), singleRow: initial[1].singleRow },
  chineseGoesToFuzzyHint: b.alerts,
  exactOrderLoaded: !!c.orderText,
  exactOrderBomLines: c.bom.length,
  fuzzyCandidates: d.candRows.length,
  pickedFromCandidates: picked.clicked && !!picked.orderText,
  barsAfterOrder: after.map((x) => ({ i: x.i, buttons: x.kids.map((k) => k.text), singleRow: x.singleRow })),
}, null, 2))

await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: 'all' })
