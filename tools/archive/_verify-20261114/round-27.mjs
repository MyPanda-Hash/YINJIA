// round-27 — B4 刷新重开 XJ-2026-11-0003 值仍在 + B5 导出 PDF
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]
async function normalWin() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) {}
}
await page.reload({ timeout: 60000 })
await page.waitForTimeout(8000)
const rail = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return { rows: [...document.querySelectorAll('.dsr-grid tbody tr')].slice(0, 5).map((x) => txt(x)) }
})
console.log('RAIL=' + JSON.stringify(rail))
const clicked = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const tr = [...document.querySelectorAll('.dsr-grid tbody tr')].find((x) => txt(x).includes('XJ-2026-11-0003'))
  if (tr) tr.click()
  return !!tr
})
console.log('OPEN=' + clicked)
await page.waitForTimeout(7000)
const reopened = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const get = (sel) => {
    const cell = document.querySelector(sel)
    if (!cell) return null
    const inp = cell.querySelector('input')
    return inp ? inp.value : txt(cell)
  }
  const active = document.querySelector('.dsr-grid tbody tr.active')
  return {
    activeRow: txt(active),
    sheet: !!document.querySelector('.lp-sheet'),
    blocks: document.querySelectorAll('.lp-grid tbody tr.is-block-first').length,
    values: {
      巡线时间: get('.lp-block[data-lp="巡线时间"]'),
      车间: get('.lp-block[data-lp="车间"]'),
      编号1: get('.lp-prod[data-lp="编号1"]'),
      长度实测1: get('.lp-prod[data-lp="长度实测1"]'),
      编号2: get('.lp-prod[data-lp="编号2"]'),
      重量实测2: get('.lp-prod[data-lp="重量实测2"]'),
      两液密度: get('.lp-block[data-lp="两液密度"]'),
      结果判定: get('.lp-block[data-lp="结果判定"]'),
      巡线人员: get('.lp-block[data-lp="巡线人员"]'),
    },
    dateVal: (() => { const i = document.querySelector('.lp-date input'); return i ? i.value : txt(document.querySelector('.lp-date')) })(),
    approver: txt(document.querySelector('.lp-head-right')),
  }
})
console.log('REOPENED=' + JSON.stringify(reopened, null, 1))
await normalWin()
await page.screenshot({ path: OUT + '/round-27-patrol-reopened.png', fullPage: true })

// —— B5: 导出 → 导出 PDF ——
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '导出')
  if (b) b.click()
})
await page.waitForTimeout(1500)
const items = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const dlg = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  return dlg ? [...dlg.querySelectorAll('.efmt-item')].map((e) => txt(e)) : []
})
console.log('EXPORT_ITEMS=' + JSON.stringify(items))
let pdf = { ok: false }
try {
  const dl = page.waitForEvent('download', { timeout: 90000 })
  await page.evaluate(() => {
    const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
    const dlg = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
    const item = dlg && [...dlg.querySelectorAll('.efmt-item')].find((e) => txt(e).includes('导出 PDF'))
    if (item) item.click()
  })
  const download = await dl
  const name = download.suggestedFilename()
  await download.saveAs(OUT + '/b5-patrol.pdf')
  pdf = { ok: true, name }
} catch (e) {
  pdf = { ok: false, err: String((e && e.message) || e) }
}
console.log('B5_PDF=' + JSON.stringify(pdf))
await page.waitForTimeout(2000)
await normalWin()
await page.screenshot({ path: OUT + '/round-27-after-export.png' })
await fs.writeFile(OUT + '/b4b5.json', JSON.stringify({ rail, clicked, reopened, items, pdf }, null, 1), 'utf8')
console.log('DONE round-27')
