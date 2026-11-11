/* round-17.mjs — 8090(jar 内 static + 正式库)复核:默认只有已完成检验 + 条件区收起 */
const task = await taskSpace('qc-pending-detail-20261111')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 60000 })
await page.waitForTimeout(9000)

const out = await page.evaluate(() => {
  const txt = (document.body.innerText || '').replace(/\s+/g, ' ')
  const m = txt.match(/共\s*(\d+)\s*条/)
  const bodyRows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const qf = document.querySelector('.fields.udl-fields')
  return {
    total: m ? Number(m[1]) : null,
    rows: bodyRows.length,
    statuses: [...new Set(bodyRows.map((tr) => {
      const td = tr.querySelectorAll('td')[5]
      return td ? (td.innerText || '').trim() : ''
    }))],
    gatedLabel: (document.querySelector('.gated-toggle') || {}).innerText || '',
    gatedChecked: !!document.querySelector('.gated-toggle.is-checked'),
    queryFieldsVisible: qf ? getComputedStyle(qf).display !== 'none' : null,
    toggleBtn: ([...document.querySelectorAll('.toolbar-query-btn')].find((b) => /条件/.test(b.innerText || '')) || {}).innerText || '',
  }
})
console.log('8090 默认态 ->', JSON.stringify(out, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-pending-detail-20261111/round-17-8090.png' })
