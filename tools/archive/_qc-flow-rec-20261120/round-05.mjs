/**
 * round-05:三处列表口径取证
 *   ① 来料品质流程监控·列表视图:列头要有「检验数据记录」;
 *   ② 来料检验单左栏:供应商下线,物料编码/物料名称上线;
 *   ③ 出货检验（功能）左栏:产品名称 → 产品编码。
 */
const OUT = 'C:/Users/vigna/ego/qc-flow-rec-20261120'
const task = await taskSpace('qc-flow-rec-20261120')
const page = task.page('p1')

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

// ① 看板 → 列表
await page.goto('http://127.0.0.1:8091/#/qc/flowMonitor', { timeout: 40000 })
await page.waitForSelector('.qcf-page', { timeout: 30000 })
await page.waitForTimeout(2000)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-radio-button__inner')].find((x) => (x.textContent || '').trim() === '列表')
  if (b) b.click()
})
await page.waitForTimeout(2500)
await restoreWindow()
const listDump = await page.evaluate(() => ({
  heads: [...document.querySelectorAll('.qcf-table .el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim()),
  rows: [...document.querySelectorAll('.qcf-table .el-table__body tr')].slice(0, 2)
    .map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())),
}))
console.log('① 列表视图 =', JSON.stringify(listDump, null, 2))
await page.screenshot({ path: OUT + '/05a-list-view.png' })

/** 读左栏(单据选择)表头 + 前几行单元格 */
async function railDump(url, shotsuffix) {
  await page.goto(url, { timeout: 40000 })
  await page.waitForTimeout(5000)
  await restoreWindow()
  const out = await page.evaluate(() => {
    const rail = document.querySelector('.doc-select-rail')
    if (!rail) return { rail: false, bodyStart: document.body.innerText.slice(0, 300) }
    const heads = [...rail.querySelectorAll('thead th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim())
    const rows = [...rail.querySelectorAll('tbody tr')].slice(0, 3)
      .map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()))
    return { rail: true, title: rail.querySelector('.dsr-title')?.textContent?.trim(), heads, rows, total: rail.querySelector('.dsr-count')?.textContent?.replace(/\s+/g, ' ').trim() }
  })
  console.log(`左栏 ${url} =`, JSON.stringify(out, null, 2))
  await page.screenshot({ path: OUT + '/' + shotsuffix })
  return out
}

// ② 来料检验单左栏
await railDump('http://127.0.0.1:8091/#/panelx/list/QC_INSP', '05b-qc-insp-rail.png')
// ③ 出货检验（功能）左栏
await railDump('http://127.0.0.1:8091/#/panelx/list/QC_PROC_INSP', '05c-qc-proc-insp-rail.png')
console.log('done')
