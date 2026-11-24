// round-19.mjs —— 绕开 ego 的 screenshot 包装:直接 CDP Page.captureScreenshot → 写盘
import fs from 'node:fs'
const task = await taskSpace('qc-detaillink-20261123')
const page = task.page('p1')
const SHOT = 'C:/Users/vigna/ego/qc-ng-flow-20261123'

async function rawShot(name) {
  try {
    const res = await page.cdp('Page.captureScreenshot', { format: 'png', fromSurface: true })
    const b64 = res?.data || res?.result?.data
    if (!b64) { console.log('SHOT NO DATA ' + name + ' ' + JSON.stringify(res).slice(0, 120)); return }
    fs.writeFileSync(SHOT + '/' + name, Buffer.from(b64, 'base64'))
    console.log('SHOT OK ' + name + ' bytes=' + Buffer.from(b64, 'base64').length)
  } catch (e) { console.log('SHOT FAIL ' + name + ': ' + e.message.slice(0, 150)) }
}

await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP?docNo=ZJ-2026-11-0009', { timeout: 45000 })
await page.waitForTimeout(10000)
const a = await page.evaluate(() => ({
  hash: location.hash, title: document.title,
  ng: !!document.querySelector('.qr-band-ng'),
  verdict: (document.body.innerText.match(/检验结论[^\n]{0,10}/) || [''])[0],
}))
console.log('A ' + JSON.stringify(a))
await rawShot('round-19-1-approved-sheet.png')

await page.goto('http://localhost:5173/#/panelx/list/QC_BHC', { timeout: 45000 })
await page.waitForTimeout(10000)
const b = await page.evaluate(() => {
  const text = (document.body.innerText || '').replace(/\s+/g, ' ')
  return {
    hash: location.hash, title: document.title,
    paperTitle: (document.querySelector('.as-title')?.innerText || '').trim(),
    docnos: (text.match(/BHC-\d{4}-\d{2}-\d{4}/g) || []).slice(0, 2),
    has出货检验单号: text.includes('出货检验单号'),
  }
})
console.log('B ' + JSON.stringify(b))
await rawShot('round-19-2-bhc-page.png')
await task.finish({ keep: [] })
