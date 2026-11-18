// round-05:把检测结果列加到 15 列,确认「列多了不挤扁 / 纸面横向滚动 / 打印仍是一页」的版面
const task = await taskSpace('qc-insp-rec-resultcols-20261119')
const page = task.page('p1')

const dump = async (tag) => {
  const st = await page.evaluate(() => {
    const wrap = document.querySelector('.qr-table-scroll')
    const table = document.querySelector('.qr-table')
    const res = document.querySelector('.qr-table tbody tr:first-child td.c-res input')
    return {
      stepperNum: document.querySelector('.qr-colstep-num')?.textContent?.trim() ?? null,
      headCells: document.querySelectorAll('.qr-table thead tr:nth-child(2) th').length,
      wrapClient: wrap ? wrap.clientWidth : null,
      wrapScroll: wrap ? wrap.scrollWidth : null,
      canScrollX: wrap ? wrap.scrollWidth > wrap.clientWidth + 2 : null,
      tableWidth: table ? Math.round(table.getBoundingClientRect().width) : null,
      tableMinWidth: table ? table.style.minWidth : null,
      resultCellWidth: res ? Math.round(res.closest('td').getBoundingClientRect().width) : null,
    }
  })
  console.log(tag + ' ' + JSON.stringify(st))
  return st
}
await dump('pre')

// ＋ 9 次:6 → 15
for (let i = 0; i < 9; i++) {
  await page.click('.qr-colstep > span:nth-child(4)', { label: '增加检测结果列' })
  await page.waitForTimeout(260)
}
await page.waitForTimeout(700)
await dump('15-cols')

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-20261119/round-05-15cols.png' })

// 上限:再加到 20 应停住(提示「已是最大列数」)
for (let i = 0; i < 6; i++) {
  await page.click('.qr-colstep > span:nth-child(4)', { label: '增加检测结果列' })
  await page.waitForTimeout(200)
}
await page.waitForTimeout(600)
await dump('max-20')
const toast = await page.evaluate(() => (document.querySelector('.el-message')?.textContent || '').trim())
console.log('toast: ' + JSON.stringify(toast))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-20261119/round-05-20cols.png' })
