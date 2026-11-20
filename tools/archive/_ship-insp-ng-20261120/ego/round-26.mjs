const fs = await import('node:fs/promises')
const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.evaluate(() => {
  document.body.classList.add('approval-printing')
  const sheet = document.querySelector('.approval-sheet')
  const paperW = sheet ? Math.max(sheet.scrollWidth, sheet.offsetWidth) : 940
  const zoom = Math.max(0.32, Math.min(1, 733 / paperW))
  document.documentElement.style.setProperty('--print-zoom', String(zoom))
  const st = document.createElement('style')
  st.id = '__pdfpage'
  st.textContent = '@page { size: A4 portrait; margin: 8mm; }'
  document.head.appendChild(st)
  window.__printMeta = { paperW, zoom, sheetH: sheet ? sheet.getBoundingClientRect().height : 0 }
})
console.log('PRINT META', JSON.stringify(await page.evaluate(() => window.__printMeta)))
const res = await page.cdp('Page.printToPDF', { printBackground: true, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.31, marginBottom: 0.31, marginLeft: 0.31, marginRight: 0.31 })
const buf = Buffer.from(res.data, 'base64')
await fs.writeFile('C:/Users/vigna/ego/qc-ng-20261120/bhc-print.pdf', buf)
const txt = buf.toString('latin1')
const pages = (txt.match(/\/Type\s*\/Page[^s]/g) || []).length
console.log('PDF bytes', buf.length, 'pages', pages)
await page.evaluate(() => {
  document.body.classList.remove('approval-printing')
  document.documentElement.style.removeProperty('--print-zoom')
  document.getElementById('__pdfpage')?.remove()
})
