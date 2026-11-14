const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
console.log('submit=' + await page.evaluate(() => {
  const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find((x) => (x.textContent || '').replace(/\s+/g, '') === '提交审批')
  if (!b) return 'NO-BTN'
  b.click(); return 'OK'
}))
await page.waitForTimeout(1600)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-message-box')].find((x) => x.offsetParent !== null)
  const b = d && [...d.querySelectorAll('button')].find((x) => /确认提交审批/.test(x.textContent || ''))
  if (b) b.click()
})
const msgs = []
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(400)
  const m = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
  if (m.length) msgs.push(...m)
}
console.log('msgs=' + JSON.stringify([...new Set(msgs)]))
await page.waitForTimeout(1500)
console.log('side=' + await page.evaluate(() => {
  const el = document.querySelector('.approval-side')
  return el ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24) : ''
}))
