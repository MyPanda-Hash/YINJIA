/**
 * round-12.mjs — 把 _q-print-sheets.mjs 生成的两张纸(sheet-plan.html / sheet-task.html)
 * 用 ego 渲染成 PDF(本机 page.screenshot 出不了帧,只能 printToPDF)。
 * 之后由 python 转 PNG。
 */
import { writeFileSync } from 'node:fs'
const EV = 'D:/workspace/yinjia/tools/archive/_wo-trace-qty-20261115/ego'
const task = await taskSpace('wo-trace-qty-20261115')
const page = task.page('p1')

const sheets = [
  ['file:///D:/workspace/yinjia/tools/archive/_wo-trace-qty-20261115/ego/sheet-plan.html', 'sheet-plan.pdf', { paperWidth: 11.7, paperHeight: 8.3, landscape: true }],
  ['file:///D:/workspace/yinjia/tools/archive/_wo-trace-qty-20261115/ego/sheet-task.html', 'sheet-task.pdf', { paperWidth: 11.7, paperHeight: 8.3, landscape: true }],
]
for (const [url, out, opt] of sheets) {
  await page.goto(url, { timeout: 30000 })
  await page.waitForTimeout(1500)
  const pdf = await page.cdp('Page.printToPDF', {
    printBackground: true, marginTop: 0.2, marginBottom: 0.2, marginLeft: 0.2, marginRight: 0.2,
    paperWidth: opt.paperWidth, paperHeight: opt.paperHeight, landscape: opt.landscape,
  })
  const b64 = pdf?.data || pdf?.result?.data
  if (b64) { writeFileSync(`${EV}/${out}`, Buffer.from(b64, 'base64')); console.log('PDF OK ' + out) }
  else console.log('PDF FAIL ' + out)
}
