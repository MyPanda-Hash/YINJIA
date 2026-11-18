// round-14:屏幕态最终复核 —— 默认 5 列(与旧版一致)+ 6 列(带一列有值),出图存档
const task = await taskSpace('qc-insp-rec-resultcols-20261119')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-11-0021', { timeout: 40000 })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(5000)

const setCols = async (target) => {
  for (let guard = 0; guard < 45; guard++) {
    const n = await page.evaluate(() => Number(document.querySelector('.qr-colstep-num')?.textContent?.trim() || 0))
    if (n === target) return n
    if (n < target) {
      await page.click('.qr-colstep > span:nth-child(4)', { label: '增加检测结果列' })
      await page.waitForTimeout(170)
    } else {
      await page.click('.qr-colstep > span:nth-child(2)', { label: '减少检测结果列' })
      await page.waitForTimeout(330)
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('.el-message-box__btns button')].find((x) => (x.textContent || '').trim() === '确定')
        if (b) b.click()
      })
      await page.waitForTimeout(380)
    }
  }
  return -1
}

const measure = async (tag) => {
  const st = await page.evaluate(() => {
    const wrap = document.querySelector('.qr-table-scroll')
    const table = document.querySelector('.qr-table')
    const cells = [...document.querySelectorAll('.qr-table tbody tr:first-child td.c-res')]
    const r = (el) => (el ? Math.round(el.getBoundingClientRect().width) : null)
    return {
      n: cells.length,
      stepperNum: document.querySelector('.qr-colstep-num')?.textContent?.trim() ?? null,
      tableW: r(table), wrapW: wrap ? wrap.clientWidth : null,
      scrollX: wrap ? wrap.scrollWidth > wrap.clientWidth + 2 : null,
      itemW: r(document.querySelector('.qr-table tbody tr:first-child td.c-item')),
      stdW: r(document.querySelector('.qr-table tbody tr:first-child td.c-std')),
      resW: r(cells[0]), lastResRight: cells.length ? Math.round(cells[cells.length - 1].getBoundingClientRect().right) : null,
      judgeRight: Math.round(document.querySelector('.qr-table tbody tr:first-child td.c-judge')?.getBoundingClientRect().right || 0),
      wrapRight: wrap ? Math.round(wrap.getBoundingClientRect().right) : null,
    }
  })
  console.log(tag + ' ' + JSON.stringify(st))
  return st
}

for (const n of [5, 6]) {
  await setCols(n)
  await page.waitForTimeout(600)
  await measure('screen-' + n)
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { /* skip */ }
  await page.screenshot({ path: `C:/Users/Lenovo/ego/qc-insp-rec-resultcols-20261119/round-14-screen-${n}cols.png` })
}
