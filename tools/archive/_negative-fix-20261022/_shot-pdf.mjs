/**
 * 用 Edge 打开本地 PDF 并截图(不用网络,规避沙箱对 127.0.0.1 的拦截)
 * file:// 本地文件是允许的。
 */
import { attachCdp } from '../_cdp.mjs'
import { writeFileSync } from 'node:fs'

const PORT = 9477
const PDF = process.argv[2]
const OUT = process.argv[3] || 'D:/YINJIA-main/tools/archive/_negative-fix-20261022/_pdf/page.png'
const PAGE = Number(process.argv[4] || 1)

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = tabs.find((t) => t.type === 'page')
const cdp = await attachCdp(PORT, page.id)
const ev = cdp.ev
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await cdp.send('Page.enable')
await cdp.send('Page.navigate', { url: 'file:///' + PDF.replace(/\\/g, '/') })
await sleep(6000)
console.log('location:', await ev('location.href'))
console.log('title:', await ev('document.title'))

// PDF 在 Edge 里是内嵌查看器(embed/pdf-viewer),截整个视口看效果
const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
const data = shot && (shot.data || (shot.result && shot.result.data))
if (!data) {
  console.log('截图返回结构:', JSON.stringify(shot).slice(0, 300))
  cdp.close()
  process.exit(1)
}
writeFileSync(OUT, Buffer.from(data, 'base64'))
console.log('截图已存:', OUT, Buffer.from(data, 'base64').length, 'bytes')
cdp.close()
