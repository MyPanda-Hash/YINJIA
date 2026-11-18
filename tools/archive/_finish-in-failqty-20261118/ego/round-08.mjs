const task = await taskSpace('finish-in-failqty')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/FINISH_IN?docNo=FI-2026-11-0010', { timeout: 30000 })
await page.waitForTimeout(4500)
const info = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.el-table__header th')].map((th) => (th.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  const body = document.querySelector('.el-table__body')
  const tr = body ? body.querySelector('tr') : null
  const idx = heads.findIndex((h) => h.startsWith('不合格数量'))
  let cellHtml = ''
  if (tr && idx >= 0) {
    const cell = tr.children[idx]
    cellHtml = cell ? cell.outerHTML.slice(0, 400) : ''
  }
  return { hash: location.hash, heads, failIdx: idx, cellHtml, docLine: (document.body.innerText || '').includes('FI-2026-11-0010') }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/finish-in-gate-qty/ego/round-08-8090.png' })
console.log('shot ok')
