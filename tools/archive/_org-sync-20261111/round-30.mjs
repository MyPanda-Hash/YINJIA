const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
const step1 = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.approval-side .as-side-btn')].map((b) => (b.textContent || '').replace(/\s+/g, ''))
  const btn = [...document.querySelectorAll('.approval-side .as-side-btn')].find((b) => (b.textContent || '').replace(/\s+/g, '') === '提交审批')
  if (!btn) return { btns, clicked: false }
  btn.click()
  return { btns, clicked: true }
})
console.log(JSON.stringify(step1))
await page.waitForTimeout(2500)
const dlg = await page.evaluate(() => {
  const boxes = [...document.querySelectorAll('.el-message-box, .el-dialog, .el-overlay')].filter((x) => x.offsetParent !== null)
  return boxes.map((d) => ({ cls: d.className, text: (d.textContent || '').replace(/\s+/g, ' ').slice(0, 160), buttons: [...d.querySelectorAll('button')].map((b) => (b.textContent || '').trim()) }))
})
console.log(JSON.stringify(dlg, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-30-dialog.png' })
