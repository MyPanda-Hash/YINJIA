/* round-19:模拟真实打印入口(注入 @page portrait + body 类 + print media)→ printToPDF */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-20261115/'
const spaces = await listTaskSpaces()
const entry = spaces.find((s) => s.name === 'sample-insp-20261115')
const task = entry.ownership === 'user' ? await claimTaskSpace(entry.id) : await taskSpace(entry.id)
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page))
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(5000)
// 与 printApprovalSheet 同一套:注入 @page、挂 body 类、等一帧
await page.evaluate(() => {
  const st = document.createElement('style')
  st.id = 'ic-print-page'
  st.textContent = '@page { size: A4 portrait; margin: 8mm; }'
  document.head.appendChild(st)
  document.body.classList.add('approval-printing')
})
await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.waitForTimeout(900)
const m = await page.evaluate(() => {
  const el = document.querySelector('.ic-sheet')
  const r = el.getBoundingClientRect()
  return { w: Math.round(r.width), h: Math.round(r.height), bodyH: document.body.scrollHeight }
})
console.log('metrics:', JSON.stringify(m))
try {
  const pdf = await page.cdp('Page.printToPDF', { printBackground: true, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.31, marginBottom: 0.31, marginLeft: 0.31, marginRight: 0.31 })
  await fs.writeFile(OUT + 'round-19-print.pdf', Buffer.from(pdf.data, 'base64'))
  console.log('PDF OK')
} catch (e) { console.log('PDF FAIL', e.message.slice(0, 120)) }
await page.evaluate(() => {
  document.body.classList.remove('approval-printing')
  document.getElementById('ic-print-page')?.remove()
})
await page.cdp('Emulation.setEmulatedMedia', { media: '' })
console.log('DONE')
