/**
 * round-04.mjs — 把 round-03 落盘的纸面 HTML 渲染成 PDF(A4 横向),再由 python 转 PNG 看版式。
 */
import { writeFileSync } from 'node:fs'
const OUT = 'D:/workspace/yinjia/_scratch/ego-plan-unreported-20261118'
const task = await taskSpace('plan-unreported-20261118')
const page = task.page('p1')
await page.goto(`file:///${OUT}/plan-5173.html`, { timeout: 30000 })
await page.waitForTimeout(1200)
const pdf = await page.cdp('Page.printToPDF', {
  printBackground: true, marginTop: 0.2, marginBottom: 0.2, marginLeft: 0.2, marginRight: 0.2,
  paperWidth: 11.7, paperHeight: 8.3, landscape: true,
})
const b64 = pdf?.data || pdf?.result?.data
if (b64) { writeFileSync(`${OUT}/plan-5173.pdf`, Buffer.from(b64, 'base64')); console.log('PDF OK') }
else console.log('PDF FAIL')
