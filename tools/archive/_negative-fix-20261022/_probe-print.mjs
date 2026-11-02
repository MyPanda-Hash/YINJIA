/**
 * 实测特采申请单打印:用 CDP 的 Emulation.setEmulatedMedia 切到 print 媒体,
 * 量纸面与各行真实高度,找出分页与截断的确切原因。
 *
 * 关键:浏览器被沙箱隔离直接访问 127.0.0.1 会落到 chrome-error,故页面内容
 * 用 node 侧抓一份 HTML 注入(只量样式,不需要数据)—— 但这样拿不到真实数据,
 * 所以改为:用 Page.setDocumentContent 注入一个最小 DOM 复刻纸面结构。
 *
 * 更可靠的做法:直接用 CDP 的 printToPDF 测量页数。
 */
import { attachCdp } from '../_cdp.mjs'

const PORT = 9477
const BASE = 'http://127.0.0.1:8090'

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = tabs.find((t) => t.type === 'page')
if (!page) { console.error('没有页面'); process.exit(1) }
const cdp = await attachCdp(PORT, page.id)
const ev = cdp.ev
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cdp.send('Page.enable')

// 检查浏览器能否访问本机服务
await cdp.send('Page.navigate', { url: BASE + '/login' })
await sleep(3500)
const href = await ev('location.href')
console.log('导航后 location:', href)
const canFetch = await ev(`window.__f = null; fetch('/api/locale/meta').then(r=>window.__f='ok:'+r.status).catch(e=>window.__f='err:'+e.message); 'go'`)
await sleep(2000)
console.log('子资源访问:', await ev('window.__f'))
const title = await ev('document.title')
console.log('document.title:', title)
cdp.close()
