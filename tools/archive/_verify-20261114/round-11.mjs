// round-11 — A3: 侧栏「导出」→ 导出 Excel / 导出 PDF,拿下载产物
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) {}
}

async function openExportMenu() {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '导出')
    if (b) b.click()
  })
  await page.waitForTimeout(1500)
  return await page.evaluate(() => {
    const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
    const dlg = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
    return {
      dialog: !!dlg,
      title: dlg ? txt(dlg.querySelector('.el-dialog__title')) : '',
      items: dlg ? [...dlg.querySelectorAll('.efmt-item')].map((e) => txt(e)) : [],
      visibleText: dlg ? txt(dlg).slice(0, 400) : '',
    }
  })
}

const menu1 = await openExportMenu()
console.log('EXPORT_MENU=' + JSON.stringify(menu1))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-11-export-menu.png' })

// —— 导出 Excel ——
let xlsxRes = { ok: false }
try {
  const dl = page.waitForEvent('download', { timeout: 60000 })
  await page.evaluate(() => {
    const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
    const dlg = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
    const item = dlg && [...dlg.querySelectorAll('.efmt-item')].find((e) => txt(e).includes('Excel'))
    if (item) item.click()
  })
  const download = await dl
  const name = download.suggestedFilename()
  await download.saveAs(OUT + '/a3-export.xlsx')
  xlsxRes = { ok: true, name }
} catch (e) {
  xlsxRes = { ok: false, err: String(e && e.message || e) }
}
console.log('XLSX=' + JSON.stringify(xlsxRes))
await page.waitForTimeout(2500)
await restoreWindow()
await page.screenshot({ path: OUT + '/round-11-after-xlsx.png' })

// —— 导出 PDF ——
const menu2 = await openExportMenu()
console.log('EXPORT_MENU2=' + JSON.stringify(menu2))
let pdfRes = { ok: false }
try {
  const dl = page.waitForEvent('download', { timeout: 60000 })
  await page.evaluate(() => {
    const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
    const dlg = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
    const item = dlg && [...dlg.querySelectorAll('.efmt-item')].find((e) => txt(e).includes('导出 PDF'))
    if (item) item.click()
  })
  const download = await dl
  const name = download.suggestedFilename()
  await download.saveAs(OUT + '/a3-export.pdf')
  pdfRes = { ok: true, name }
} catch (e) {
  pdfRes = { ok: false, err: String(e && e.message || e) }
}
console.log('PDF=' + JSON.stringify(pdfRes))
await page.waitForTimeout(4000)
const stateAfter = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return {
    dialogs: [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent !== null).map((x) => txt(x.querySelector('.el-dialog__title'))),
    iframes: [...document.querySelectorAll('iframe')].map((f) => f.src).slice(0, 4),
    msgs: (window.__msgs || []).slice(-6),
    bodyHits: (document.body.innerText || '').includes('导出'),
  }
})
console.log('STATE_AFTER=' + JSON.stringify(stateAfter))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-11-after-pdf.png' })
const ls = await fs.readdir(OUT)
console.log('FILES=' + JSON.stringify(ls.filter((f) => f.startsWith('a3-'))))
console.log('DONE round-11')
