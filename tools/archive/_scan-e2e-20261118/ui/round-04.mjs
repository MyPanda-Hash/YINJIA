const task = await taskSpace('scan-e2e-20261118')
const page = task.page('p1')
const out = {}

// ① 扫码混料:用**真实工单码格式** 公司代码@工单号@(1000+行号) 扫进去
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 30000 })
await page.waitForTimeout(3000)
await page.fill('input[placeholder*="二维码"]', '0@GD-2026-11-0010@1003')
await page.keyboard.press('Enter')
await page.waitForTimeout(4000)
out.mix = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('tbody tr')]
  return {
    bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 600),
    tableRowCount: rows.length,
    firstRows: rows.slice(0, 6).map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 90)),
    focusPlaceholder: (document.activeElement && document.activeElement.placeholder) || document.activeElement?.tagName,
  }
})
await page.screenshot({ path: 'C:/Users/Lenovo/ego/scan-e2e-20261118/page-MOBILE_MIX_SCAN-loaded.png' })

// ② 工序报工:看进页面时光标到底在哪个框
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_REPORT', { timeout: 30000 })
await page.waitForTimeout(3500)
out.report = await page.evaluate(() => {
  const ae = document.activeElement
  return {
    focusTag: ae ? ae.tagName : '',
    focusPlaceholder: ae ? ae.placeholder || '' : '',
    inputs: [...document.querySelectorAll('input')].map((i) => ({ ph: i.placeholder, type: i.type })),
  }
})

// ③ 生产领料:输入工单号 → 点「打开单据」→ 应出现该工单的两张单
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_PICK', { timeout: 30000 })
await page.waitForTimeout(3500)
await page.fill('input[placeholder*="扫工单号"]', 'GD-2026-11-0010')
const btnOk = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('打开单据'))
  if (!b) return false
  b.click()
  return true
})
await page.waitForTimeout(3500)
out.pick = await page.evaluate(() => ({
  clickedOk: true,
  bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 500),
  dialogOpen: !!document.querySelector('.el-dialog'),
  buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => t && t.length < 12).slice(0, 12),
}))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/scan-e2e-20261118/page-MOBILE_PICK-located.png' })

console.log(JSON.stringify(out, null, 2))
