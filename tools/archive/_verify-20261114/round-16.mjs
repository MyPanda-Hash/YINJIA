// round-16 — A3 PDF:重载页面后(本次导航首个下载)导出 PDF
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const task = await takeOverTaskSpace(3)
const page = (await task.pages())[0]

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser/setWindowBounds')
  } catch (e) {}
}
async function normalWin() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) {}
}

await page.reload({ timeout: 60000 })
await page.waitForTimeout(8000)
// 打开 SJ-2026-11-0011
const clicked = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const tr = [...document.querySelectorAll('.dsr-grid tbody tr')].find((x) => txt(x).includes('SJ-2026-11-0011'))
  if (tr) tr.click()
  return !!tr
})
console.log('OPEN=' + clicked)
await page.waitForTimeout(7000)
console.log('SHEET=' + await page.evaluate(() => !!document.querySelector('.fi-grid') && document.querySelectorAll('.sample-row td.gz-y').length))

// 打开导出菜单
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
console.log('ITEMS=' + JSON.stringify(items))

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
  await download.saveAs(OUT + '/a3-export.pdf')
  pdf = { ok: true, name }
} catch (e) {
  pdf = { ok: false, err: String((e && e.message) || e) }
}
console.log('PDF=' + JSON.stringify(pdf))
await page.waitForTimeout(3000)
const state = await page.evaluate(() => ({
  dialogs: [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent !== null).length,
  msgs: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()),
}))
console.log('STATE=' + JSON.stringify(state))
const ls = await fs.readdir(OUT)
console.log('FILES=' + JSON.stringify(ls.filter((f) => f.startsWith('a3-'))))
await normalWin()
await page.screenshot({ path: OUT + '/round-16-after-pdf.png' })
console.log('DONE round-16')
