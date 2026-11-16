// round-06.mjs — 补打印一次(打印次数 1→2),再去「生产过程 → 混料记录」看这张单
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')
await page.evaluate(() => { window.print = () => console.info('[verify] window.print suppressed') })

await page.click('.mm-doc .el-button', { label: '补打印' })
await page.waitForTimeout(3500)
const reprint = await page.evaluate(() => ({
  printMsg: document.querySelector('.mm-print-msg .el-alert__title')?.textContent?.trim() || '',
  printTimes: [...document.querySelectorAll('.mm-doc-print')].map((e) => e.textContent.trim()),
  docs: [...document.querySelectorAll('.mm-doc')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
}))
console.log('reprint:', JSON.stringify(reprint, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-20261118/r6-reprint.png' })

// 电脑端「混料记录」面板:新单据应该直接看得到
await page.goto('http://127.0.0.1:8090/#/panelx/list/WO_MIXING_LIST', { timeout: 40000 })
await page.waitForTimeout(4500)
const panel = await page.evaluate(() => ({
  hash: location.hash,
  title: document.title,
  heads: [...document.querySelectorAll('.el-table__header th .cell')].slice(0, 20).map((e) => e.textContent.trim()),
  firstRow: [...document.querySelectorAll('.el-table__body tr')].slice(0, 3)
    .map((tr) => [...tr.querySelectorAll('td .cell')].map((c) => c.textContent.trim()).join(' | ')),
}))
console.log('mixing panel:', JSON.stringify(panel, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-20261118/r6-mixing-list.png' })
