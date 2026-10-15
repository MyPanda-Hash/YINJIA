/**
 * 诊断(2026-10-15):为什么截图时面板显示「单据: - 第 0/0 张」+「角色列表加载失败」。
 *
 * 已知:同一 token 用 curl 调 /px/queryFormDataList 能正常返回 3874 行 ⇒ 后端没问题。
 * 怀疑:注入 localStorage 的方式让前端拿到的用户/权限态不完整(如 rolePanels/visiblePanels 缺失),
 *   导致 PanelxList 初始化时拿不到"当前角色可见列",整页渲染失败。
 * 做法:CDP 打开页面,**抓 console 错误 + network 失败请求**,把真实原因打印出来(只读)。
 * 用法: node tools/archive/_diag-shot-blank-1015.mjs [host]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const host = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = mkdtempSync(join(tmpdir(), 'edge-diag-'))
const port = 9346
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' })

let ws, msgId = 0
const pending = new Map()
const consoleMsgs = []
const failed = []
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
        if (m.method === 'Runtime.consoleAPICalled') {
          consoleMsgs.push(m.params.type + ': ' + (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200))
        }
        if (m.method === 'Network.responseReceived') {
          const st = m.params.response.status
          if (st >= 400) failed.push(st + ' ' + m.params.response.url.replace(host, ''))
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

// —— 完全复刻截图脚本的注入方式 ——
await send('Page.navigate', { url: host + '/#/login' })
await sleep(3500)
const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
console.log('登录返回的 user 字段:', Object.keys(lg.data.user || {}).join(', '))
console.log('visiblePanels =', JSON.stringify(lg.data.user?.visiblePanels))
console.log('isAdmin =', lg.data.user?.isAdmin)

await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))}); 'ok'`)
await send('Page.reload', { ignoreCache: true })
await sleep(6500)
await ev(`location.hash = '#/panelx/list/INV'; 'ok'`)
await sleep(7000)

const state = await ev(`(() => JSON.stringify({
  hash: location.hash,
  rows: document.querySelectorAll('.el-table__body tbody tr').length,
  banner: (document.body.innerText.match(/角色列表加载失败|失败/g)||[]).slice(0,3),
  sideText: document.body.innerText.slice(0,60),
}))()`)
console.log('\n页面状态:', state)
console.log('\n=== 失败的网络请求 ===')
console.log(failed.length ? failed.join('\n') : '(无)')
console.log('\n=== console 错误(最多 15 条)===')
console.log(consoleMsgs.filter((m) => /error|warn/i.test(m)).slice(0, 15).join('\n') || '(无)')

try { edge.kill() } catch {}
process.exit(0)
