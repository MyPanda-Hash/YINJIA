import fsp from 'node:fs/promises'

const DIR = 'C:/Users/Lenovo/ego/gen-lines-select-all-20261118'
await fsp.mkdir(DIR, { recursive: true })

const task = await taskSpace('gen-lines-select-all-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 30000 })
await page.waitForTimeout(3000)

const info = await page.evaluate(() => {
  const rail = document.querySelector('.doc-select-rail')
  const rows = [...document.querySelectorAll('.dsr-grid tbody tr')]
  const tb = [...document.querySelectorAll('button')].filter((b) => /生单/.test(b.textContent || ''))
  return {
    hash: location.hash,
    railExists: !!rail,
    railHeaders: [...document.querySelectorAll('.dsr-grid thead th')].map((t) => (t.textContent || '').replace(/\s+/g, ' ').trim()),
    row1: rows.slice(0, 4).map((tr) => ({
      cls: tr.className,
      cells: [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()),
      hasCheckbox: !!tr.querySelector('input[type=checkbox], .el-checkbox'),
    })),
    genButtons: tb.map((b) => ({ text: (b.textContent || '').trim(), cls: b.className, html: b.outerHTML.slice(0, 260) })),
    groupHtml: (() => {
      const el = tb[0]?.closest('[class*="tb-"], .el-button-group, div')
      return el ? el.outerHTML.slice(0, 900) : ''
    })(),
  }
})
console.log(JSON.stringify(info, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: DIR + '/round-02-rail.png', fullPage: false })
