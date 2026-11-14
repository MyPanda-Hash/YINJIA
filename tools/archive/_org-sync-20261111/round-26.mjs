const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.approval-side .as-side-btn')].find((b) => (b.textContent || '').replace(/\s+/g, '') === '提交审批')
  if (btn) btn.click()
})
await page.waitForTimeout(1200)
// 可能弹审批意见框:先看有没有,再确定
const dialog = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-message-box, .el-dialog')].find((x) => x.offsetParent !== null)
  return d ? { text: (d.textContent || '').replace(/\s+/g, ' ').slice(0, 120), buttons: [...d.querySelectorAll('button')].map((b) => (b.textContent || '').trim()) } : null
})
console.log('dialog=' + JSON.stringify(dialog))
if (dialog) {
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-message-box, .el-dialog')].find((x) => x.offsetParent !== null)
    const btn = [...d.querySelectorAll('button')].find((b) => /确定|提交|是/.test((b.textContent || '')))
    if (btn) btn.click()
  })
  await page.waitForTimeout(1500)
}
const msgs = []
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(400)
  const m = await page.evaluate(() => [...document.querySelectorAll('.el-message, .el-message-box')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
  if (m.length) msgs.push(...m)
}
console.log('msgs=' + JSON.stringify([...new Set(msgs)]))
const state = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  return { side: (txt(document.querySelector('.approval-side')) || '').slice(0, 46) }
})
console.log(JSON.stringify(state))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-26-submitted.png' })
