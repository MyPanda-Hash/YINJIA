/**
 * 诊断(2026-10-15):复现"连续跳多个面板时,有的面板 rows=0"。
 *
 * 假设:v2 截图脚本在一张接一张跳面板时,**上一张的慢查询还在飞**,此时改 location.hash
 *   要么被 Vue Router 丢掉、要么新旧请求竞态把新页面的数据覆盖成空。
 *   实测单开一个面板(只跳一次、等 12s)是正常的 25 行 ⇒ 说明问题出在"连续跳"。
 *
 * 做法:按 v2 的顺序连跳 5 个面板,每个都等就绪,打印各自 rows/total —— 看是否复现。
 * 只读。用法: node tools/archive/_diag-seq-nav-1015.mjs [host]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const host = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = mkdtempSync(join(tmpdir(), 'edge-seq-'))
const port = 9349
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' })

let ws, msgId = 0
const pending = new Map()
const pxReqs = []
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) {
      ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data)
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
        if (m.method === 'Network.requestWillBeSent' && m.params.request.url.includes('queryFormDataList')) {
          pxReqs.push({ t: Date.now(), body: (m.params.request.postData || '').slice(0, 120) })
        }
      }
      break
    }
  } catch {}
  await sleep(500)
}
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
await send('Page.navigate', { url: host + '/#/login' })
await sleep(3500)
const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))}); 'ok'`)
await send('Page.reload', { ignoreCache: true })
await sleep(6500)
console.log('[boot] 已登录\n')

async function st() {
  return JSON.parse(await ev(`(() => JSON.stringify({
    rows: document.querySelectorAll('.el-table__body tbody tr').length,
    total: (document.body.innerText.match(/第\\s*\\d+\\s*\\/\\s*(\\d+)\\s*张/)||[null,null])[1],
    hash: location.hash,
  }))()`) || '{}')
}

// v2 的顺序:INV(慢) → MANU_ORDER → ROUTE → QC_INSP
const seq = [
  ['#/panelx/list/INV', '商品'],
  ['#/panelx/list/MANU_ORDER', '生产工单'],
  ['#/panelx/list/ROUTE', '工艺路线'],
  ['#/panelx/list/QC_INSP', '来料检验单'],
]

for (const [hash, name] of seq) {
  pxReqs.length = 0
  const before = await st()
  await ev(`location.hash = ${JSON.stringify(hash)}; 'ok'`)
  // 每张最多等 25s,轮询到 rows>0 且 total>0
  let s = {}, waited = 0
  while (waited < 25000) {
    s = await st()
    if (s.rows > 0 && s.total && Number(s.total) > 0) break
    await sleep(1000); waited += 1000
  }
  console.log(`${name.padEnd(8)} 跳转前 rows=${before.rows} → 现 rows=${s.rows} total=${s.total} (等 ${waited/1000}s) 请求数=${pxReqs.length}`)
  if (pxReqs.length) console.log('   请求体:', pxReqs.map((r) => r.body).join(' | '))
}

try { edge.kill() } catch {}
process.exit(0)
