/** 排查 CDP ev 返回值 */
import { attachCdp } from '../_cdp.mjs'
const PORT = 9477
const BASE = 'http://127.0.0.1:8090'
const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = tabs.find((t) => t.type === 'page')
console.log('目标页面:', page.url)
const cdp = await attachCdp(PORT, page.id)
await cdp.send('Page.enable')
await cdp.send('Page.navigate', { url: BASE + '/login' })
await new Promise((r) => setTimeout(r, 4000))
console.log('location:', await cdp.ev('location.href'))
console.log('title:', await cdp.ev('document.title'))
console.log('简单求值 1+1:', await cdp.ev('1+1'))
const raw = await cdp.send('Runtime.evaluate', { expression: '({a:1})', returnByValue: true })
console.log('原始返回:', JSON.stringify(raw).slice(0, 400))
cdp.close()
