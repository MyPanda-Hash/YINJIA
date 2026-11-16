/* round-33:8090 最终复核 —— 打印预览(原生) + 导出 PDF(html2canvas,截 blob) */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-print-fix-20261116/'
const task = await taskSpace(7)
const page = (await task.pages())[0]
await page.goto('http://127.0.0.1:8090/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await page.waitForTimeout(9000)
console.log('state:', JSON.stringify(await page.evaluate(() => ({ hash: location.hash, docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim(), inputs: document.querySelectorAll('.ic-sheet input').length }))))
// ① 打印预览:拦截 window.print
await page.evaluate(() => { window.__printCalled = 0; window.print = () => { window.__printCalled++ } })
await page.evaluate(() => { const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === '导出'); b && b.click() })
await page.waitForTimeout(1200)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth)
  const hit = [...d.querySelectorAll('*')].find((e) => (e.textContent || '').trim() === '打印预览' && !e.children.length)
  if (hit) hit.click()
})
await page.waitForTimeout(3000)
console.log('打印预览:', JSON.stringify(await page.evaluate(() => ({
  printCalled: window.__printCalled,
  host: !!document.getElementById('yj-print-host'),
  bodyClass: document.body.classList.contains('approval-printing'),
  pageStyle: !!document.getElementById('ic-print-page'),
}))))
// 清理打印态
await page.evaluate(() => { document.body.classList.remove('approval-printing'); document.getElementById('ic-print-page')?.remove(); document.documentElement.style.removeProperty('--print-zoom') })
// ② 导出 PDF(截 blob)
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
await page.waitForTimeout(9000)
const b64 = await page.evaluate(async () => {
  const blob = window.__pdfBlob
  if (!blob) return ''
  return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.readAsDataURL(blob) })
})
if (b64) { await fs.writeFile(OUT + 'export-8090-final.pdf', Buffer.from(b64, 'base64')); console.log('saved export-8090-final.pdf', (await fs.stat(OUT + 'export-8090-final.pdf')).size) }
else console.log('NO PDF BLOB')
