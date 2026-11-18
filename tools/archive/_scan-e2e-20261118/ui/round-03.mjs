const task = await taskSpace('scan-e2e-20261118')
const page = task.page('p1')

const out = {}

// ① 生产退料:进页面是"选一张可退的领料单",选完才出现扫物料框
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_RETURN', { timeout: 30000 })
await page.waitForTimeout(3500)
out.returnListButtons = await page.evaluate(() => [...document.querySelectorAll('button')]
  .map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim())
  .filter((t) => t && t.length < 12).slice(0, 6))
// 点第一张「选这张退料」
const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('选这张退料'))
  if (!btn) return false
  btn.click()
  return true
})
await page.waitForTimeout(3000)
out.returnAfterPick = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input')]
  const scan = inputs.find((i) => (i.placeholder || '').includes('扫描') || (i.placeholder || '').includes('扫'))
  const ae = document.activeElement
  return {
    clickedOk: true,
    hasScanInput: !!scan,
    scanPlaceholder: scan ? scan.placeholder : '',
    focusIsScan: !!(scan && ae === scan),
    focusPlaceholder: ae ? ae.placeholder || ae.tagName : '',
    buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => t && t.length < 12).slice(0, 10),
    text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
  }
})
await page.screenshot({ path: 'C:/Users/Lenovo/ego/scan-e2e-20261118/page-MOBILE_RETURN-detail.png' })

// ② 工序报工:扫工单框 + 聚焦
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_REPORT', { timeout: 30000 })
await page.waitForTimeout(3500)
out.report = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input')]
  const scan = inputs.find((i) => (i.placeholder || '').includes('扫'))
  const ae = document.activeElement
  return {
    hasScanInput: !!scan,
    scanPlaceholder: scan ? scan.placeholder : '',
    focusIsScan: !!(scan && ae === scan),
    buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => t && t.length < 12).slice(0, 10),
  }
})
await page.screenshot({ path: 'C:/Users/Lenovo/ego/scan-e2e-20261118/page-MOBILE_REPORT.png' })

// ③ 扫码混料:真扫一张工单(GD-2026-11-0010)→ 应带出物料清单 5 行(只在页面里看,不保存)
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 30000 })
await page.waitForTimeout(3500)
const scanSel = 'input[placeholder*="扫描"], input[placeholder*="二维码"]'
await page.fill(scanSel, 'GD-2026-11-0010')
await page.keyboard.press('Enter')
await page.waitForTimeout(4000)
out.mixAfterScan = await page.evaluate(() => {
  const txt = (document.body.innerText || '').replace(/\s+/g, ' ')
  return {
    text: txt.slice(0, 500),
    tableRows: document.querySelectorAll('tbody tr').length,
    inputs: [...document.querySelectorAll('input')].map((i) => i.placeholder).slice(0, 8),
  }
})
await page.screenshot({ path: 'C:/Users/Lenovo/ego/scan-e2e-20261118/page-MOBILE_MIX_SCAN-after-scan.png' })

console.log(JSON.stringify(out, null, 2))
