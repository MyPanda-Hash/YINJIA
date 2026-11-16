/* round-06:导出 → 导出 PDF(截图路径)下载并留存,验证无编辑控件/无挤压 */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-print-fix-20261116/'
const task = await taskSpace(5)
const page = (await task.pages())[0]
const st = await page.evaluate(() => ({ docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim(), inputs: document.querySelectorAll('.ic-sheet input').length }))
console.log('state:', JSON.stringify(st))
const dlPromise = page.waitForEvent('download', { timeout: 90000 })
await page.evaluate(() => { const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === '导出'); b && b.click() })
await page.waitForTimeout(1200)
const clicked = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth)
  if (!d) return { err: 'no dialog' }
  const hit = [...d.querySelectorAll('*')].find((e) => (e.textContent || '').trim() === '导出 PDF' && !e.children.length)
  if (!hit) return { err: 'no 导出 PDF' }
  hit.click(); return { ok: true }
})
console.log('click 导出 PDF:', JSON.stringify(clicked))
let dl = null
try { dl = await dlPromise } catch (e) { console.log('download wait fail: ' + e.message.slice(0, 120)) }
if (dl) {
  console.log('download:', dl.suggestedFilename())
  await dl.saveAs(OUT + 'export-sheet.pdf')
  console.log('saved export-sheet.pdf', (await fs.stat(OUT + 'export-sheet.pdf')).size)
}
