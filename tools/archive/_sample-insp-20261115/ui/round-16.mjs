/* round-16:尝试 Page.printToPDF 出真实打印 PDF(最接近打印机的输出) */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-20261115/'
const spaces = await listTaskSpaces()
const entry = spaces.find((s) => s.name === 'sample-insp-20261115')
const task = entry.ownership === 'user' ? await claimTaskSpace(entry.id) : await taskSpace(entry.id)
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page))
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(5000)
await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.evaluate(() => document.body.classList.add('approval-printing'))
await page.waitForTimeout(800)
try {
  const pdf = await page.cdp('Page.printToPDF', { printBackground: true, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.31, marginBottom: 0.31, marginLeft: 0.31, marginRight: 0.31 })
  const buf = Buffer.from(pdf.data, 'base64')
  await fs.writeFile(OUT + 'round-16-commission-print.pdf', buf)
  console.log('PDF OK bytes=', buf.length)
} catch (e) { console.log('PDF FAIL', e.message.slice(0, 150)) }
await page.evaluate(() => document.body.classList.remove('approval-printing'))
await page.cdp('Emulation.setEmulatedMedia', { media: '' })
console.log('DONE')
