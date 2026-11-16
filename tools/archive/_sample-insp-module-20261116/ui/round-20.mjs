/* round-20:清掉 deviceMetricsOverride 后重新打印(真实屏幕宽度 973) */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-module-20261116/'
const task = await taskSpace(1)
const page = (await task.pages())[0]
try { await page.cdp('Emulation.clearDeviceMetricsOverride', {}) } catch (e) { console.log('clear metrics skip: ' + e.message) }
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(6000)
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
  return { vw: innerWidth, w: Math.round(r.width), h: Math.round(r.height), bodyH: document.body.scrollHeight }
})
console.log('print metrics:', JSON.stringify(metrics))
try {
  const pdf = await page.cdp('Page.printToPDF', { printBackground: true, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.31, marginBottom: 0.31, marginLeft: 0.31, marginRight: 0.31 })
  await fs.writeFile(OUT + 'round-20-print.pdf', Buffer.from(pdf.data, 'base64'))
  console.log('PDF OK')
} catch (e) { console.log('PDF FAIL', e.message.slice(0, 150)) }
await page.evaluate(() => { document.body.classList.remove('approval-printing'); document.getElementById('ic-print-page')?.remove() })
await page.cdp('Emulation.setEmulatedMedia', { media: '' })
