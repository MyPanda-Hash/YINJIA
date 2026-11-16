/* round-19:刷新后复核持久化 + 打印 PDF(应为 1 页 A4 竖版,且三行合并值有值) */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-module-20261116/'
const task = await taskSpace(1)
const page = (await task.pages())[0]
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false })
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(6000)
let st = await page.evaluate(() => ({ docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim(), inputs: document.querySelectorAll('.ic-sheet input').length }))
console.log('state:', JSON.stringify(st))
if (!st.docNo.includes('WT-')) {
  await page.evaluate(() => { const r = document.querySelector('.doc-select-rail tbody tr'); r && r.click() })
  await page.waitForTimeout(4000)
}
const vals = await page.evaluate(() => {
  const trs = [...document.querySelectorAll('.ic-grid tr')].slice(0, 3)
  return trs.map((tr) => ({ th: (tr.querySelector('th')?.innerText || '').replace(/\s+/g, ' ').trim(), vals: [...tr.querySelectorAll('input')].map((i) => i.value) }))
})
console.log('party rows after reload:', JSON.stringify(vals, null, 2))

async function shotPaper(file, scale = 1.3) {
  const url = await page.evaluate(async (sc) => {
    const m = await import('/node_modules/.vite/deps/modern-screenshot.js')
    const el = document.querySelector('.ic-sheet')
    const w0 = Math.max(el.scrollWidth, el.offsetWidth)
    const h0 = Math.max(el.scrollHeight, el.offsetHeight)
    return await m.domToPng(el, { scale: sc, backgroundColor: '#ffffff', width: w0, height: h0 })
  }, scale)
  if (url.err) { console.log('SHOT FAIL', url.err); return }
  await fs.writeFile(OUT + file, Buffer.from(String(url).split(',')[1], 'base64'))
  console.log('shot', file)
}
await shotPaper('round-19-saved-reload.png')

await page.evaluate(() => {
  const st = document.createElement('style'); st.id = 'ic-print-page'
  st.textContent = '@page { size: A4 portrait; margin: 8mm; }'
  document.head.appendChild(st)
  document.body.classList.add('approval-printing')
})
await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.waitForTimeout(1000)
const metrics = await page.evaluate(() => {
  const el = document.querySelector('.ic-sheet'); const r = el.getBoundingClientRect()
  return { w: Math.round(r.width), h: Math.round(r.height), bodyH: document.body.scrollHeight }
})
console.log('print metrics:', JSON.stringify(metrics))
try {
  const pdf = await page.cdp('Page.printToPDF', { printBackground: true, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.31, marginBottom: 0.31, marginLeft: 0.31, marginRight: 0.31 })
  await fs.writeFile(OUT + 'round-19-print.pdf', Buffer.from(pdf.data, 'base64'))
  console.log('PDF OK')
} catch (e) { console.log('PDF FAIL', e.message.slice(0, 150)) }
await page.evaluate(() => { document.body.classList.remove('approval-printing'); document.getElementById('ic-print-page')?.remove() })
await page.cdp('Emulation.setEmulatedMedia', { media: '' })
