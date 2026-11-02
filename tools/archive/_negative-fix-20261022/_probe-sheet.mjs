/**
 * 实测:特采申请单(QC_TC_IN)文书的真实高度与文本截断
 * 注:CDP 的 ev 对「async 立即返回 Promise」不稳,这里一律用「先塞全局变量再轮询读取」的方式取异步结果。
 */
import { attachCdp } from '../_cdp.mjs'

const PORT = 9477
const BASE = 'http://127.0.0.1:8090'
const DOC = process.argv[2] || ''

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = tabs.find((t) => t.type === 'page' && t.url.startsWith('http://127.0.0.1:8090'))
if (!page) { console.error('没有页面'); process.exit(1) }
const cdp = await attachCdp(PORT, page.id)
const ev = cdp.ev
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cdp.send('Page.enable')

/** 执行一段 async 代码,把它塞进 window.__r,轮询取回 JSON */
async function runAsync(code) {
  await ev(`window.__r = null; (async () => { try { ${code} } catch (e) { window.__r = { __err: String(e) } } })(); 'go'`)
  for (let i = 0; i < 25; i++) {
    await sleep(400)
    const s = await ev('JSON.stringify(window.__r)')
    if (s && s !== 'null' && s !== 'undefined') return JSON.parse(s)
  }
  return null
}

await cdp.send('Page.navigate', { url: BASE + '/login' })
await sleep(3000)

const login = await runAsync(`
  const r = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ userName:'admin', password:'123456', factory:'YJ' }) });
  const j = await r.json();
  if (j.code === 0 || j.code === 200) {
    localStorage.setItem('mes_token', j.data.token);
    localStorage.setItem('mes_user', JSON.stringify(j.data.user || {}));
    window.__r = { ok: true };
  } else window.__r = { ok: false, j: JSON.stringify(j).slice(0, 300) };
`)
console.log('登录:', JSON.stringify(login))
if (!login || !login.ok) { cdp.close(); process.exit(1) }

let docNo = DOC
if (!docNo) {
  const res = await runAsync(`
    const r = await fetch('/api/px/queryFormDataList', { method:'POST',
      headers:{'Content-Type':'application/json', Authorization:'Bearer '+localStorage.getItem('mes_token')},
      body: JSON.stringify({ panelCode:'QC_TC_IN', pageNo:1, pageSize:5 }) });
    const j = await r.json();
    const rows = (j.data && (j.data.rows || j.data.list || j.data)) || [];
    window.__r = { rows: Array.isArray(rows) ? rows.slice(0,3) : j };
  `)
  console.log('查询:', JSON.stringify(res).slice(0, 700))
  const rows = res && res.rows
  if (Array.isArray(rows) && rows.length) docNo = rows[0]['单据编号'] || rows[0]['编号']
}
console.log('\n特采单号:', docNo)
cdp.close()
