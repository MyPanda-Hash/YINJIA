// round-15 — 终验:已作废→说清已作废 / 不存在→通用兜底 / 存在→正常打开
const BASE = 'http://localhost:5173'
const task = await taskSpace('qc rec detail index link prod')
const page = task.page('p1')
async function pollMsgs(ms) {
  const seen = new Set()
  const end = Date.now() + ms
  while (Date.now() < end) {
    const now = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
    now.forEach((m) => seen.add(m))
    await page.waitForTimeout(120)
  }
  return [...seen]
}
async function rows() {
  return await page.evaluate(() => {
    const t = [...document.querySelectorAll('table')].find((x) => x.querySelectorAll('tbody tr').length > 0)
    return t ? t.querySelectorAll('tbody tr').length : 0
  })
}
await page.goto(BASE + '/#/panelx/list/QC_INSP?docNo=IJ-2026-10-0036', { timeout: 120000 })
console.log('已作废 → ' + JSON.stringify(await pollMsgs(5000)) + ' 列表行数=' + await rows())
await page.goto(BASE + '/#/panelx/list/QC_INSP?docNo=IJ-2099-01-9999', { timeout: 120000 })
console.log('不存在 → ' + JSON.stringify(await pollMsgs(5000)) + ' 列表行数=' + await rows())
await page.goto(BASE + '/#/panelx/list/QC_INSP?docNo=IJ-2026-10-0020', { timeout: 120000 })
console.log('存在 → ' + JSON.stringify(await pollMsgs(4000)) + ' 单据=' + await page.evaluate(() => (document.body.innerText.match(/单据：([^\s]+)/) || ['', ''])[1]))
