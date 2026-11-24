// round-01.mjs —— 出货检验（表观）明细表:单号列现状取证(2026-11-23)
// 目的:① 页面能开、行数/列名;② 单据编号 / 工单号 两列是不是渲染成链接(.doc-no-link);
//       ③ 其它列不是链接;④ 打印首行两列的值(供 round-02 点击对照)。
const task = await taskSpace('qc-detaillink-20261123')
const page = task.page('p1')
const TARGET = 'http://localhost:5173/#/panelx/list/QC_ASM_INSP_DETAIL'

async function loginIfNeeded() {
  const inputs = await page.evaluate(() => [...document.querySelectorAll('input')].map((i) => i.placeholder || ''))
  if (!inputs.some((p) => p.includes('账号'))) return false
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
  return true
}

await page.goto(TARGET, { timeout: 30000 })
await page.waitForTimeout(3000)
if (await loginIfNeeded()) {
  await page.goto(TARGET, { timeout: 30000 })
  await page.waitForTimeout(5000)
}
// 等表格出数据
for (let i = 0; i < 20; i++) {
  const n = await page.evaluate(() => document.querySelectorAll('.report-table .el-table__body tr').length)
  if (n > 0) break
  await page.waitForTimeout(1000)
}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

const info = await page.evaluate(() => {
  const table = document.querySelector('.report-table')
  const headCells = [...(table?.querySelectorAll('.el-table__header th') || [])].map((th) => (th.innerText || '').replace(/\s+/g, ' ').trim())
  const rows = [...(table?.querySelectorAll('.el-table__body tr') || [])]
  const first = rows[0]
  const firstCells = first ? [...first.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()) : []
  const linkCells = [...(table?.querySelectorAll('.doc-no-link') || [])]
  const linkCols = [...new Set(linkCells.map((el) => {
    const td = el.closest('td')
    const idx = td ? [...td.parentElement.children].indexOf(td) : -1
    return idx
  }))]
  return {
    hash: location.hash,
    title: document.title,
    hasTable: !!table,
    rowCount: rows.length,
    headCells,
    firstCells,
    linkCount: linkCells.length,
    linkCellColumnIndexes: linkCols.sort((a, b) => a - b),
    sampleLinks: linkCells.slice(0, 6).map((el) => el.textContent.trim()),
    // 中文列名 → 是否链接(按列头文字定位)
    perColumn: headCells.map((h, i) => ({
      col: h,
      link: first ? !!first.children[i]?.querySelector?.('.doc-no-link') : false,
      value: firstCells[i] || '',
    })),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-detaillink-20261123/round-01-list.png' })
await task.finish({ keep: [] })
