/**
 * 在真实服务页面上量「不良说明」行(需登录后打开特采单详情)。
 * 若浏览器仍被沙箱拦住访问 127.0.0.1,则退化为纯 CSS 测量。
 */
import { attachCdp } from '../_cdp.mjs'

const PORT = 9477
const BASE = 'http://127.0.0.1:8090'
const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = tabs.find((t) => t.type === 'page')
const cdp = await attachCdp(PORT, page.id)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cdp.send('Page.enable')
await cdp.send('Page.navigate', { url: BASE + '/login' })
await sleep(4000)
const href = await cdp.ev('location.href')
console.log('location:', href)
if (String(href).startsWith('chrome-error')) {
  console.log('浏览器无法访问本机服务 → 改用源码级验证')
  cdp.close()
  process.exit(2)
}
cdp.close()
