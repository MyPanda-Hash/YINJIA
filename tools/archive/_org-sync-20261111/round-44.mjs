const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-11-0004', { timeout: 60000 })
await page.waitForTimeout(9000)
const sub = await page.evaluate(() => {
  const t = localStorage.getItem('mes_token') || ''
  try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub } catch (e) { return null }
})
console.log('sub=' + sub)
console.log('side=' + await page.evaluate(() => {
  const el = document.querySelector('.approval-side')
  return el ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30) : ''
}))
console.log('click=' + await page.evaluate(() => {
  const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find((x) => (x.textContent || '').replace(/\s+/g, '') === '提交审批')
  if (!b) return 'NO-BTN'
  b.click(); return 'OK'
}))
await page.waitForTimeout(1500)
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
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-44-submit-fm-only.png' })
