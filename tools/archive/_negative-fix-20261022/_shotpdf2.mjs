/** 渲染当地 PDF 并截图为 PNG(用 Edge 内置 PDF 查看器,file:// 可访问) */
import { attachCdp } from '../_cdp.mjs'
import { writeFileSync } from 'node:fs'

const PORT = 9477
const PDF = process.argv[2]
const OUT = process.argv[3]

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = tabs.find((t) => t.type === 'page')
const cdp = await attachCdp(PORT, page.id)
const ev = cdp.ev
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await cdp.send('Page.enable')
// 设一个宽高比接近 A4 的视口,让整页能看清
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1400, deviceScaleFactor: 1, mobile: false })
await cdp.send('Page.navigate', { url: 'file:///' + PDF.replace(/\\/g, '/') })
await sleep(7000)
console.log('location:', await ev('location.href'))

const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
const data = shot.data || (shot.result && shot.result.data)
writeFileSync(OUT, Buffer.from(data, 'base64'))
console.log('截图:', OUT, Buffer.from(data, 'base64').length, 'bytes')
await cdp.send('Emulation.clearDeviceMetricsOverride')
cdp.close()
