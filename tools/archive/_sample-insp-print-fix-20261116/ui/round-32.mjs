/* round-32:5173 html2canvas 截图导出验证(截 blob,不触发下载) */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-print-fix-20261116/'
const task = await taskSpace(7)
const page = (await task.pages())[0]
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await page.waitForTimeout(7000)
console.log('state:', JSON.stringify(await page.evaluate(() => ({ docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim(), inputs: document.querySelectorAll('.ic-sheet input').length }))))
// 填一些值(不保存,仅验证截图渲染)
await page.evaluate(() => {
  const setNative = (inp, v) => {
    const proto = inp.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(inp, v)
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const rows = [...document.querySelectorAll('.ic-grid tr')]
  const row = (t) => rows.find((r) => (r.querySelector('th')?.innerText || '').replace(/\s+/g, ' ').trim().startsWith(t))
  const setRow = (t, vals) => { const ins = [...(row(t)?.querySelectorAll('input') || [])]; vals.forEach((v, i) => { if (ins[i]) setNative(ins[i], v) }) }
  setRow('委托单位/单位地址', ['联调委托单位', '惠州市测试路 1 号'])
  setRow('制造商/地址', ['联调制造商', '惠州市测试路 2 号'])
  setRow('生产厂/地址', ['联调生产厂', '惠州市测试路 3 号'])
  setRow('联系人', ['张三', '13800000000', 'a@b.c'])
  setRow('样品名称', ['测试样品', 'TM', '2L'])
  // 拦截 blob 产出(jsPDF save 内部用 object URL)
  window.__pdfBlob = null
  const origCreate = URL.createObjectURL.bind(URL)
  URL.createObjectURL = (blob) => { if (blob && String(blob.type).includes('pdf')) window.__pdfBlob = blob; return origCreate(blob) }
  const origClick = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () { if (this.href && this.href.startsWith('blob:')) return; return origClick.call(this) }
})
await page.waitForTimeout(600)
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
if (b64) { await fs.writeFile(OUT + 'export-h2c.pdf', Buffer.from(b64, 'base64')); console.log('saved export-h2c.pdf', (await fs.stat(OUT + 'export-h2c.pdf')).size) }
else console.log('NO PDF BLOB')
