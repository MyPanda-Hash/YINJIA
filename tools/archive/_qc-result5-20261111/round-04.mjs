const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
// 停在面板上(上一轮同 hash,goto 相同地址不会重载,这里先回桌面再进,确保拿到干净状态)
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC', { timeout: 60000 })
await page.waitForTimeout(6000)

const clickByText = async (sel, text) => page.evaluate(([s, t]) => {
  const el = [...document.querySelectorAll(s)].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === t
    || (e.textContent || '').replace(/\s+/g, ' ').trim().startsWith(t))
  if (!el) return 'NOT-FOUND:' + t
  el.click()
  return 'CLICKED:' + t
}, [sel, text])

console.log(await clickByText('.approval-side button, .approval-side .el-button, .approval-side li, .approval-side div', '新增'))
await page.waitForTimeout(4000)

const probe = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const bodyTable = document.querySelector('.qc-rec-sheet table.qr-table')
  return {
    addBar: txt(document.querySelector('.qr-addbar')),
    rowCount: bodyTable ? bodyTable.querySelectorAll('tbody tr').length : 0,
    emptyText: txt(document.querySelector('.qr-empty')),
    inputs: document.querySelectorAll('.qc-rec-sheet table.qr-table tbody input').length,
    title: txt(document.querySelector('.qr-title')),
    headVals: [...document.querySelectorAll('.qr-head-table .qr-value')].map((c) => (txt(c) || '').slice(0, 20)),
  }
})
console.log(JSON.stringify(probe, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-04.png' })
