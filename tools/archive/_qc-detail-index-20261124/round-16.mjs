// round-16 — 逐个独立复核(每次整页重载,避免上一轮消息串味)
const BASE = 'http://localhost:5173'
const task = await taskSpace('qc rec detail index link prod')
const page = task.page('p1')
async function fresh(url, ms) {
  await page.goto(url, { timeout: 120000 })
  await page.reload({ timeout: 120000 })
  const seen = new Set()
  const end = Date.now() + (ms || 8000)
  while (Date.now() < end) {
    const now = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
    now.forEach((m) => seen.add(m))
    await page.waitForTimeout(150)
  }
  const rows = await page.evaluate(() => {
    const t = [...document.querySelectorAll('table')].find((x) => x.querySelectorAll('tbody tr').length > 0)
    return t ? t.querySelectorAll('tbody tr').length : 0
  })
  const doc = await page.evaluate(() => (document.body.innerText.match(/单据：([^\s]+)/) || ['', ''])[1])
  return { msgs: [...seen], rows, doc, url: await page.url() }
}
console.log('已作废 → ' + JSON.stringify(await fresh(BASE + '/#/panelx/list/QC_INSP?docNo=IJ-2026-10-0036')))
console.log('不存在 → ' + JSON.stringify(await fresh(BASE + '/#/panelx/list/QC_INSP?docNo=IJ-2099-01-9999')))
console.log('存在   → ' + JSON.stringify(await fresh(BASE + '/#/panelx/list/QC_INSP?docNo=IJ-2026-10-0020', 5000)))
