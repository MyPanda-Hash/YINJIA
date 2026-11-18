// round-06:版面复核(定宽模型):6 / 10 / 15 / 20 列各测一次宽度,15 列截图;最后刷新丢弃未保存改动
const task = await taskSpace('qc-insp-rec-resultcols-20261119')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC', { timeout: 40000 })
await page.waitForTimeout(4000)

const dump = async (tag) => {
  const st = await page.evaluate(() => {
    const wrap = document.querySelector('.qr-table-scroll')
    const table = document.querySelector('.qr-table')
    const cells = [...document.querySelectorAll('.qr-table tbody tr:first-child td.c-res')]
    const base = (sel) => Math.round(document.querySelector('.qr-table tbody tr:first-child td' + sel)?.getBoundingClientRect().width || 0)
    return {
      n: document.querySelectorAll('.qr-table thead tr:nth-child(2) th').length,
      stepperNum: document.querySelector('.qr-colstep-num')?.textContent?.trim() ?? null,
      tableWidth: table ? Math.round(table.getBoundingClientRect().width) : null,
      wrapClient: wrap ? wrap.clientWidth : null,
      canScrollX: wrap ? wrap.scrollWidth > wrap.clientWidth + 2 : null,
      itemW: base('.c-item'),
      stdW: base('.c-std'),
      methodW: base('.c-method'),
      judgeW: base('.c-judge'),
      resW: cells.length ? Math.round(cells[0].getBoundingClientRect().width) : 0,
      resultRightEdge: cells.length ? Math.round(cells[cells.length - 1].getBoundingClientRect().right) : null,
      viewportRight: Math.round(document.querySelector('.qr-table-scroll').getBoundingClientRect().right),
    }
  })
  console.log(tag + ' ' + JSON.stringify(st))
  return st
}
await dump('6-cols')

// 6 → 10
for (let i = 0; i < 4; i++) { await page.click('.qr-colstep > span:nth-child(4)', { label: '增加检测结果列' }); await page.waitForTimeout(220) }
await page.waitForTimeout(500)
await dump('10-cols')

// 10 → 15
for (let i = 0; i < 5; i++) { await page.click('.qr-colstep > span:nth-child(4)', { label: '增加检测结果列' }); await page.waitForTimeout(220) }
await page.waitForTimeout(500)
await dump('15-cols')

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-20261119/round-06-15cols.png' })

// 15 → 20
for (let i = 0; i < 5; i++) { await page.click('.qr-colstep > span:nth-child(4)', { label: '增加检测结果列' }); await page.waitForTimeout(200) }
await page.waitForTimeout(500)
await dump('20-cols')
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-20261119/round-06-20cols.png' })

// 刷新丢弃未保存改动(回到库里存的列数)
await page.reload({ timeout: 40000 })
await page.waitForTimeout(4000)
await dump('after-reload')
