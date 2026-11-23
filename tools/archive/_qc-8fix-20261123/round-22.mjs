// round-22: 出货检验（功能）纸面:抬头/表尾换行与批次格对齐
const task = await taskSpace('qc-8fix-20261123')
const page = await task.newPage()
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 60000 })
await page.waitForTimeout(8000)
await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((n) => (n.innerText || '').includes('ZC-2026-11-0010'))
  if (tr) tr.click()
})
await page.waitForTimeout(3000)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('*')].find((x) => (x.innerText || '').trim() === '«' && x.clientWidth < 40)
  if (btn) btn.click()
})
await page.waitForTimeout(1200)
console.log(JSON.stringify(await page.evaluate(() => {
  const cells = [...document.querySelectorAll('.qr-grid tbody td, .qr-head-table td, .qr-foot-table td, .qr-head-table th, .qr-foot-table th')]
  const overflow = cells.filter((c) => c.scrollWidth > c.clientWidth + 1).slice(0, 8).map((c) => ({
    cls: c.className, tag: c.tagName, w: c.clientWidth, sw: c.scrollWidth, text: (c.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 20),
  }))
  const foot = [...document.querySelectorAll('.qr-foot-table tr')].map((tr) => [...tr.children].map((c) => ({
    w: Math.round(c.getBoundingClientRect().width), text: (c.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 18),
  })))
  return {
    sheetW: Math.round(document.querySelector('.qr-sheet').getBoundingClientRect().width),
    overflow,
    foot,
    headRows: [...document.querySelectorAll('.qr-head-table tr')].map((tr) => [...tr.children].map((c) => Math.round(c.getBoundingClientRect().width))),
  }
}), null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-22-oqc.png' })
