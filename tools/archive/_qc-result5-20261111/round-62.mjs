const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-11-0007', { timeout: 60000 })
await page.waitForTimeout(9000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
const state = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const foot = document.querySelector('.qr-foot-table')
  const rows = foot ? [...foot.querySelectorAll('tr')] : []
  return {
    side: (txt(document.querySelector('.approval-side')) || '').slice(0, 24),
    footRows: rows.map((tr) => [...tr.children].map((c) => (txt(c) || '').slice(0, 14))),
    reqMarks: [...document.querySelectorAll('.qr-req')].length,
    judgeMarks: [...document.querySelectorAll('th.c-judge .qr-req')].length,
    disposalSelect: !!document.querySelector('.qr-foot-table tr:nth-child(2) td:last-child .el-select'),
  }
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-62-foot.png' })

// 直接点保存:验证 检验结论/处理意见/单项判定 必填
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find((x) => (x.textContent || '').replace(/\s+/g, '') === '保存')
  if (b) b.click()
})
const msgs = []
for (let i = 0; i < 16; i++) {
  await page.waitForTimeout(400)
  const m = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
  if (m.length) msgs.push(...m)
}
console.log('saveMsgs=' + JSON.stringify([...new Set(msgs)]))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-63-required.png' })
