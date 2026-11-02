/**
 * 实测特采申请单打印效果(修复后)
 * 用 CDP Page.printToPDF 数页数,并量纸面在 print 媒体下的实际尺寸。
 */
import { attachCdp } from '../_cdp.mjs'
import { writeFileSync } from 'node:fs'

const PORT = 9477
const BASE = 'http://127.0.0.1:8090'
const DOC = process.argv[2]

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = tabs.find((t) => t.type === 'page')
const cdp = await attachCdp(PORT, page.id)
const ev = cdp.ev
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cdp.send('Page.enable')

async function runAsync(code) {
  await ev(`window.__r = null; (async () => { try { ${code} } catch (e) { window.__r = { __err: String(e) } } })(); 'go'`)
  for (let i = 0; i < 30; i++) {
    await sleep(400)
    const s = await ev('JSON.stringify(window.__r)')
    if (s && s !== 'null' && s !== 'undefined') return JSON.parse(s)
  }
  return null
}

await cdp.send('Page.navigate', { url: BASE + '/login' })
await sleep(3500)
console.log('location:', await ev('location.href'))
if (String(await ev('location.href')).startsWith('chrome-error')) {
  console.log('❌ 浏览器仍无法访问本机服务(沙箱限制),无法做真实渲染测量')
  cdp.close()
  process.exit(2)
}

const login = await runAsync(`
  const r = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ userName:'admin', password:'123456', factory:'YJ' }) });
  const j = await r.json();
  if (j.code === 0 || j.code === 200) {
    localStorage.setItem('mes_token', j.data.token);
    localStorage.setItem('mes_user', JSON.stringify(j.data.user || {}));
    window.__r = { ok: true };
  } else window.__r = { ok:false, j: JSON.stringify(j).slice(0,200) };
`)
console.log('登录:', JSON.stringify(login))
cdp.close()
