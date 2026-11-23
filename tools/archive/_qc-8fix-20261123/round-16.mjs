// round-16: 量 QC_BHC 第 3 行三格宽度/文字方向, 定位挤压
const task = await taskSpace('qc-8fix-20261123')
const page = await task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_BHC', { timeout: 60000 })
await page.waitForTimeout(6000)
await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((n) => (n.innerText || '').includes('BHC-2026-11-0002'))
  if (tr) tr.click()
})
await page.waitForTimeout(2500)
console.log(JSON.stringify(await page.evaluate(() => {
  const sheet = document.querySelector('.approval-sheet')
  const pairs = [...document.querySelectorAll('.q-pair')].slice(0, 12).map((p) => {
    const lbl = p.querySelector('.q-label')
    const val = p.querySelector('.q-value')
    return {
      text: (p.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30),
      pairW: Math.round(p.getBoundingClientRect().width),
      flex: getComputedStyle(p).flex,
      labelW: lbl ? Math.round(lbl.getBoundingClientRect().width) : null,
      labelText: lbl ? (lbl.innerText || '').trim().slice(0, 10) : null,
      valW: val ? Math.round(val.getBoundingClientRect().width) : null,
      valText: val ? (val.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 12) : null,
    }
  })
  const title = document.querySelector('.as-title')
  return {
    paperW: sheet ? Math.round(sheet.getBoundingClientRect().width) : null,
    titleW: title ? Math.round(title.getBoundingClientRect().width) : null,
    titleFont: title ? getComputedStyle(title).fontSize : null,
    infoW: Math.round(document.querySelector('.as-info-table')?.getBoundingClientRect().width || 0),
    pairs,
  }
}), null, 1))
