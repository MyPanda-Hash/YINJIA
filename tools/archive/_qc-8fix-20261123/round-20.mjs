// round-20: 新页签(无缓存)验证 提交时间 含时分 + 已审核/草稿回退
const task = await taskSpace('qc-8fix-20261123')
const page = await task.newPage()
await page.goto('http://localhost:5173/#/panelx/list/QC_BHC', { timeout: 60000 })
await page.waitForTimeout(8000)
for (const no of ['BHC-2026-11-0002', 'BHC-2026-11-0001', 'BHC-2026-09-0001']) {
  await page.evaluate((no) => {
    const tr = [...document.querySelectorAll('tr')].find((n) => (n.innerText || '').includes(no))
    if (tr) tr.click()
  }, no)
  await page.waitForTimeout(2500)
  console.log(no, JSON.stringify(await page.evaluate(() => ({
    infoRows: [...document.querySelectorAll('.as-info-row')].map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim()),
    signLines: [...document.querySelectorAll('.q-signline')].map((x) => (x.innerText || '').replace(/\s+/g, ' ').trim()),
  }))))
}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-20-time.png' })
