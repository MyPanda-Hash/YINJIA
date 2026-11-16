// round-55:出货检验表观侧栏审批按钮验收(只读观察,不改数据)
const task = await taskSpace('lead-qc-yj154-20261111')
const page = task.page('p1')
const probe = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s)
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const btns = [...document.querySelectorAll('.approval-side .as-side-btn')].map((b) => ({ t: (b.textContent || '').trim(), disabled: b.classList.contains('disabled') }))
  return {
    title: txt(q('.qr-title')),
    tabs: [...document.querySelectorAll('.dsr-tabs .dsr-tab')].map((b) => ({ t: b.textContent.trim(), on: b.classList.contains('active') })),
    count: txt(q('.dsr-count')),
    status: txt(q('.doc-status')),
    sideButtons: btns.filter((b) => ['提交审批', '审批通过', '审批驳回', '弃审', '审批情况', '审核'].includes(b.t)),
    docNo: txt(q('.doc-chip')),
  }
})
await page.goto('http://localhost:5173/#/dashboard', { timeout: 30000 })
await page.waitForTimeout(1200)
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 30000 })
await page.evaluate(() => location.reload())
await page.waitForTimeout(8000)
console.log('DEFAULT=' + JSON.stringify(await probe()))
await page.evaluate(() => [...document.querySelectorAll('.dsr-tabs .dsr-tab')].find((x) => x.textContent.trim() === '未完成')?.click())
await page.waitForTimeout(2500)
await page.evaluate(() => document.querySelectorAll('.dsr-grid tbody tr')[0]?.click())
await page.waitForTimeout(2800)
console.log('DRAFT=' + JSON.stringify(await probe()))
