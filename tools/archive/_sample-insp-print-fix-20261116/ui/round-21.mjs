/* round-21:修复后重导 PDF(应有:无按钮/日期控件/占位,且文字不重叠) */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-print-fix-20261116/'
const task = await taskSpace(6)
const page = (await task.pages())[0]
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await page.waitForTimeout(7000)
console.log('state:', JSON.stringify(await page.evaluate(() => ({ hash: location.hash, docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim(), inputs: document.querySelectorAll('.ic-sheet input').length }))))
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
try { dl = await dlPromise } catch (e) { console.log('download fail: ' + e.message.slice(0, 100)) }
if (dl) {
  await dl.saveAs(OUT + 'export-fixed.pdf')
  console.log('saved export-fixed.pdf', (await fs.stat(OUT + 'export-fixed.pdf')).size)
}
