const task = await taskSpace('qc-docs-20261118')
const page = task.page('p1')

async function wide() {
  try {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
    await page.waitForTimeout(300)
  } catch (e) {}
}

const code = process.env.PANEL || 'QC_INSP_REQ_SERIES'
await page.goto(`http://localhost:5173/#/panelx/list/${code}`, { timeout: 30000 })
await page.waitForTimeout(6000)
await wide()
const before = await page.evaluate(() => {
  const trs = [...document.querySelectorAll('.qc-paper tbody tr')]
  const data = trs.filter((r) => r.querySelector('.rs-td'))
  const h = data.map((r) => Math.round(r.getBoundingClientRect().height))
  const editBtn = document.querySelector('.rs-op-edit')
  return {
    hash: location.hash,
    rows: h.slice(0, 6),
    hasEditBtn: !!editBtn,
    firstRowText: (data[0]?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    textareaRendered: !!document.querySelector('.qc-paper textarea'),
  }
})
console.log('before edit:', JSON.stringify(before))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-docs-20261118/r03-before.png' })

// 点第一行「修改」
const clicked = await page.evaluate(() => {
  const b = document.querySelector('.rs-op-edit')
  if (!b) return false
  b.click()
  return true
})
await page.waitForTimeout(1500)
const after = await page.evaluate(() => {
  const trs = [...document.querySelectorAll('.qc-paper tbody tr')]
  const data = trs.filter((r) => r.querySelector('.rs-td'))
  const h = data.map((r) => Math.round(r.getBoundingClientRect().height))
  const editRow = document.querySelector('.qc-paper tr[data-edit="1"]')
  const areas = [...document.querySelectorAll('.qc-paper textarea')]
  return {
    rows: h.slice(0, 6),
    editRowH: editRow ? Math.round(editRow.getBoundingClientRect().height) : 0,
    textareas: areas.length,
    firstTextareaValue: areas[0] ? String(areas[0].value).slice(0, 60) : '',
    textareaHeights: areas.slice(0, 8).map((a) => Math.round(a.getBoundingClientRect().height)),
  }
})
console.log('clicked edit:', clicked)
console.log('after edit:', JSON.stringify(after))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-docs-20261118/r03-after.png' })
console.log('done')
