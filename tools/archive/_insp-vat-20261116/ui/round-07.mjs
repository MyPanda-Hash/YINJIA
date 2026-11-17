/* round-07:重新进面板选 WT-2026-11-0006 → 干净截屏 + 打印 PDF + 导出 PDF */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/insp-vat-20261116/'
const task = await taskSpace('insp-vat-20261116')
const page = (await task.pages())[0]
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await page.waitForTimeout(8000)
console.log('state:', JSON.stringify(await page.evaluate(() => ({ docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim(), inputs: document.querySelectorAll('.ic-sheet input').length, rail: [...document.querySelectorAll('.doc-select-rail tbody tr')].slice(0, 3).map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60)) }))))
let st = await page.evaluate(() => ({ docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim() }))
if (!st.docNo.includes('WT-')) {
  await page.evaluate(() => { const r = document.querySelector('.doc-select-rail tbody tr'); r && r.click() })
  await page.waitForTimeout(4000)
}
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1200, deviceScaleFactor: 1, mobile: false })
await page.waitForTimeout(1000)
const r = await page.evaluate(() => {
  const el = document.querySelector('.ic-sheet'); const b = el.getBoundingClientRect()
  return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim() }
})
console.log('rect:', JSON.stringify(r))
const sc = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1.6 } })
await fs.writeFile(OUT + 'round-07-sheet.png', Buffer.from(sc.data, 'base64'))
console.log('shot round-07-sheet.png')
// 打印 PDF
await page.evaluate(() => {
  document.body.classList.add('approval-printing')
  if (!document.getElementById('ic-print-page')) { const s = document.createElement('style'); s.id = 'ic-print-page'; s.textContent = '@page { size: A4 portrait; margin: 8mm; }'; document.head.appendChild(s) }
})
await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.waitForTimeout(800)
const pdf = await page.cdp('Page.printToPDF', { printBackground: true, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.315, marginBottom: 0.315, marginLeft: 0.315, marginRight: 0.315 })
await fs.writeFile(OUT + 'round-07-print.pdf', Buffer.from(pdf.data, 'base64'))
console.log('saved round-07-print.pdf')
await page.evaluate(() => { document.body.classList.remove('approval-printing'); document.getElementById('ic-print-page')?.remove() })
await page.cdp('Emulation.setEmulatedMedia', { media: '' })
// 导出 PDF
await page.evaluate(() => {
  window.__pdfBlob = null
  const origCreate = URL.createObjectURL.bind(URL)
  URL.createObjectURL = (blob) => { if (blob && String(blob.type).includes('pdf')) window.__pdfBlob = blob; return origCreate(blob) }
  const origClick = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () { if (this.href && this.href.startsWith('blob:')) return; return origClick.call(this) }
})
await page.evaluate(() => { const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === '导出'); b && b.click() })
await page.waitForTimeout(1200)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth)
  const hit = [...d.querySelectorAll('*')].find((e) => (e.textContent || '').trim() === '导出 PDF' && !e.children.length)
  if (hit) hit.click()
})
await page.waitForTimeout(10000)
const b64 = await page.evaluate(async () => {
  const blob = window.__pdfBlob
  if (!blob) return ''
  return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.readAsDataURL(blob) })
})
if (b64) { await fs.writeFile(OUT + 'round-07-export.pdf', Buffer.from(b64, 'base64')); console.log('saved round-07-export.pdf', (await fs.stat(OUT + 'round-07-export.pdf')).size) }
else console.log('NO PDF BLOB')
