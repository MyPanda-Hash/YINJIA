const task = await taskSpace('material-ret-fix-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MATERIAL_RET', { timeout: 45000 })
await page.waitForTimeout(4500)

const out = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const rail = document.querySelector('.dsr, .doc-select-rail, .doc-rail, [class*="rail"]')
  const railRoot = [...document.querySelectorAll('div')].find((el) => /选择$/.test(txt(el)) && txt(el).length < 40 && el.querySelector('table, .el-table'))
  const root = railRoot || rail
  return {
    hash: location.hash,
    hasError: txt(document.body).includes('服务异常'),
    railTitle: root ? txt(root).slice(0, 30) : null,
    railHeads: root ? [...root.querySelectorAll('th')].map(txt).filter(Boolean) : [],
    railRows: root ? [...root.querySelectorAll('tbody tr')].slice(0, 4).map((tr) => [...tr.querySelectorAll('td')].map(txt)) : [],
    railCount: root ? txt(root).match(/共有数据[^\d]*(\d+)/)?.[1] ?? null : null,
  }
})
console.log(JSON.stringify(out, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/material-ret-fix-20261117/round-09-rail.png' })
