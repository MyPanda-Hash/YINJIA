const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
await page.evaluate(() => {
  const btn = document.querySelector('.approval-side .as-side-btn.primary')
  if (btn) btn.click()
})
const msgs = []
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(400)
  const m = await page.evaluate(() => [...document.querySelectorAll('.el-message, .el-message-box, .el-dialog')]
    .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
  if (m.length) msgs.push(...m)
}
console.log(JSON.stringify([...new Set(msgs)], null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-11.png' })
