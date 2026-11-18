const task = await taskSpace('material-ret-fix-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/SALE_IN', { timeout: 45000 })
await page.waitForTimeout(5000)

const out = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const body = txt(document.body)
  const root = [...document.querySelectorAll('div')].find((el) => /销售退货单选择/.test(txt(el)) && el.querySelector('.el-table'))
  return {
    hash: location.hash,
    hasError: body.includes('服务异常') || body.includes('列名'),
    railPresent: body.includes('销售退货单选择'),
    railText: root ? txt(root).slice(0, 200) : (body.match(/销售退货单选择.{0,120}/) || [''])[0],
    railHeads: root ? [...root.querySelectorAll('th')].map(txt).filter(Boolean) : [],
    railRows: root ? [...root.querySelectorAll('tbody tr')].slice(0, 3).map((tr) => [...tr.querySelectorAll('td')].map(txt)) : [],
    docNo: (body.match(/单据[：:]\s*([A-Z]{2,4}-[\d-]+)/) || [])[1] || null,
  }
})
console.log(JSON.stringify(out, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/material-ret-fix-20261117/round-11-salein-rail.png' })
