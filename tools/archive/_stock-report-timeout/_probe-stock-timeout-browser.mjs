/**
 * _probe-stock-timeout-browser.mjs — 真浏览器复现:库存报表三张表打开时的网络耗时与报错
 *
 * 做什么:headless Edge 登录 8090 → 依次打开 STOCK_BALANCE / STOCK_LEDGER / STOCK_SUMMARY,
 *   用 CDP Network 事件统计每个 XHR 的墙钟耗时,抓出 > 5s 的请求、axios 超时报错与页面提示。
 * 用法:node tools/archive/_stock-report-timeout/_probe-stock-timeout-browser.mjs [host]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const host = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const OUT = 'tools/archive/_stock-report-timeout'
const PANELS = ['STOCK_BALANCE', 'STOCK_LEDGER', 'STOCK_SUMMARY']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })

const profile = mkdtempSync(join(tmpdir(), 'edge-stk-'))
const port = 9351
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1600,1000', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' })

let ws, msgId = 0
const pending = new Map()
const inflight = new Map()   // requestId -> { url, method, t0 }
const slow = []              // { url, ms, status }
const finished = []
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) {
      ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data)
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
        if (m.method === 'Network.requestWillBeSent' && m.params.request.url.includes('/api/')) {
          const pd = m.params.request.postData || ''
          let pc = ''
          try { pc = JSON.parse(pd).panelCode || '' } catch {}
          inflight.set(m.params.requestId, { url: m.params.request.url, method: m.params.request.method, pc, pd: pd.slice(0, 200), t0: Date.now() })
        }
        if (m.method === 'Network.loadingFinished' && inflight.has(m.params.requestId)) {
          const r = inflight.get(m.params.requestId); inflight.delete(m.params.requestId)
          const ms = Date.now() - r.t0
          finished.push({ ...r, ms })
          if (ms > 5000) slow.push({ url: r.url, ms })
        }
        if (m.method === 'Network.loadingFailed' && inflight.has(m.params.requestId)) {
          const r = inflight.get(m.params.requestId); inflight.delete(m.params.requestId)
          slow.push({ url: r.url, ms: Date.now() - r.t0, err: m.params.errorText })
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
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })

await send('Page.navigate', { url: host + '/#/login' })
await sleep(3500)
const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
if (!lg?.data?.token) { console.error('[FATAL] 登录失败'); process.exit(1) }
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
await send('Page.reload', { ignoreCache: true })
await sleep(6000)
console.log('[login] ok')

const report = []
for (const p of PANELS) {
  inflight.clear(); finished.length = 0; slow.length = 0
  const errs = []
  // 记录页面上的错误提示
  await ev(`window.__toasts = []; if (!window.__toastHooked) { window.__toastHooked = 1;
    const mo = new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) {
      const t = (n.innerText||'').trim(); if (t) window.__toasts.push(t.slice(0,120)) } });
    mo.observe(document.body, { childList: true, subtree: true }); } 'ok'`)
  await ev(`location.hash = '#/panelx/list/${p}'; 'ok'`)
  await sleep(16000)
  const state = await ev(`(() => {
    const rows = document.querySelectorAll('.el-table__body tbody tr').length
    const txt = (document.body.innerText||'')
    return JSON.stringify({ rows, toasts: window.__toasts || [],
      err: /timeout of|超时|加载失败|Network Error/i.test(txt) ? txt.match(/.{0,60}(timeout of|超时|加载失败|Network Error).{0,60}/i)[0] : null,
      pager: (document.querySelector('.report-pager, .rp-text, .page-no')||{}).innerText || '' })
  })()`)
  const top = finished.filter(f => f.ms > 300).sort((a, b) => b.ms - a.ms).slice(0, 8)
  const byPanel = {}
  for (const f of finished) {
    const k = (f.pc || f.url.replace(host, '')) + '|' + f.pd.replace(/\s+/g, '')
    byPanel[k] = byPanel[k] || { n: 0, max: 0 }
    byPanel[k].n++; byPanel[k].max = Math.max(byPanel[k].max, f.ms)
  }
  report.push({ panel: p, state: JSON.parse(state || '{}'), slow: slow.slice(), top, byPanel })
  console.log(`\n=== ${p} ===`)
  const st = JSON.parse(state || '{}')
  console.log('  页面: rows=' + st.rows + ' pager=' + st.pager + ' err=' + st.err + ' toasts=' + JSON.stringify((st.toasts || []).filter(t => t.length < 60).slice(0, 6)))
  for (const f of top) console.log(`  ${String(f.ms).padStart(7)} ms  ${f.method} ${f.url}  panel=${f.pc} body=${f.pd}`)
  console.log('  ── 全部 /api 请求(按 body 归并) ──')
  for (const [k, v] of Object.entries(byPanel).sort((a, b) => b[1].max - a[1].max)) console.log(`    ×${String(v.n).padStart(2)}  max ${String(v.max).padStart(6)} ms  ${k}`)
  for (const s of slow) console.log(`  [SLOW] ${String(s.ms).padStart(7)} ms  ${s.url} ${s.err || ''}`)
}

writeFileSync(join(OUT, 'out-browser-repro.json'), JSON.stringify(report, null, 1))
console.log('\n[OK] out-browser-repro.json 已写入')
try { edge.kill() } catch {}
process.exit(0)
