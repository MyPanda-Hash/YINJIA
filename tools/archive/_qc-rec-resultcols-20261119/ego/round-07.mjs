// round-07:定宽模型复核(每格 58px):6 列应无横向滚动;加到 15 列看版面;截图;刷新回滚未保存改动
const task = await taskSpace('qc-insp-rec-resultcols-20261119')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC', { timeout: 40000 })
await page.waitForTimeout(4500)

const dump = async (tag) => {
  const st = await page.evaluate(() => {
    const wrap = document.querySelector('.qr-table-scroll')
    const table = document.querySelector('.qr-table')
    const cells = [...document.querySelectorAll('.qr-table tbody tr:first-child td.c-res')]
    const w = (sel) => Math.round(document.querySelector('.qr-table tbody tr:first-child td' + sel)?.getBoundingClientRect().width || 0)
    return {
      n: document.querySelectorAll('.qr-table thead tr:nth-child(2) th').length,
      stepperNum: document.querySelector('.qr-colstep-num')?.textContent?.trim() ?? null,
      tableWidth: table ? Math.round(table.getBoundingClientRect().width) : null,
      wrapClient: wrap ? wrap.clientWidth : null,
      wrapScroll: wrap ? wrap.scrollWidth : null,
      canScrollX: wrap ? wrap.scrollWidth > wrap.clientWidth + 2 : null,
      itemW: w('.c-item'), stdW: w('.c-std'), methodW: w('.c-method'),
      judgeW: w('.c-judge'), resW: cells.length ? Math.round(cells[0].getBoundingClientRect().width) : 0,
      lastResRight: cells.length ? Math.round(cells[cells.length - 1].getBoundingClientRect().right) : null,
      wrapRight: wrap ? Math.round(wrap.getBoundingClientRect().right) : null,
      values6: [...document.querySelectorAll('.qr-table tbody tr:first-child td.c-res input')].map((i) => i.value).filter(Boolean),
    }
  })
  console.log(tag + ' ' + JSON.stringify(st))
  return st
}
await dump('saved-6-cols')

// 6 → 10 → 15
for (let i = 0; i < 4; i++) { await page.click('.qr-colstep > span:nth-child(4)', { label: '增加检测结果列' }); await page.waitForTimeout(200) }
await page.waitForTimeout(500)
await dump('10-cols')
for (let i = 0; i < 5; i++) { await page.click('.qr-colstep > span:nth-child(4)', { label: '增加检测结果列' }); await page.waitForTimeout(200) }
await page.waitForTimeout(600)
await dump('15-cols')

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-20261119/round-07-15cols.png' })

// 滚到最右看看结果列
await page.evaluate(() => { const w = document.querySelector('.qr-table-scroll'); if (w) w.scrollLeft = w.scrollWidth })
await page.waitForTimeout(600)
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-20261119/round-07-15cols-scrolled.png' })
await page.evaluate(() => { const w = document.querySelector('.qr-table-scroll'); if (w) w.scrollLeft = 0 })
await page.waitForTimeout(300)

// 刷新丢弃未保存改动
await page.reload({ timeout: 40000 })
await page.waitForTimeout(4000)
await dump('after-reload')
