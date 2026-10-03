/* CPU 剖面:一次 TEAM→INV 切换的函数级耗时归因(CDP Profiler,1ms 采样)
   用法: node tools/archive/_cpu-profile.cjs [baseUrl] [从面板] [到面板]
   输出:按 self-time 聚合的 TOP 函数 / TOP 模块(url)/ 长帧样本 —— 宽表卡顿的根因归因。 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const FROM = process.argv[3] || 'TEAM'
const TO = process.argv[4] || 'INV'
const API = 'http://localhost:8090'
const PORT = 9454
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  }).then((r) => r.json())
  const token = login.data.token, user = JSON.stringify(login.data.user)
  const H = { Authorization: `Bearer ${token}` }
  const cfgF = await fetch(`${API}/api/px/getPanelConfig?panelCode=${FROM}`, { headers: H }).then((r) => r.json())
  const cfgT = await fetch(`${API}/api/px/getPanelConfig?panelCode=${TO}`, { headers: H }).then((r) => r.json())
  const expF = (cfgF.data?.metadata?.panelPageDto?.tablePages?.[0]?.gridTabs?.[0]?.columns || []).length
  const expT = (cfgT.data?.metadata?.panelPageDto?.tablePages?.[0]?.gridTabs?.[0]?.columns || []).length

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-cpu-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--window-size=1440,900`,
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
    const evaluate = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1200)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(user)}); localStorage.setItem('mes_init_done','1'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
    await send('Page.navigate', { url: `${BASE}/#/panelx/list/${FROM}` }); await sleep(5000)

    const waitPanel = async (p, exp, ms = 15000) => {
      const t0 = Date.now()
      while (Date.now() - t0 < ms) {
        const th = await evaluate(`document.querySelectorAll('.el-table__header th').length`)
        if (Math.abs(th - exp) <= 2 && !(await evaluate(`!!document.querySelector('.el-loading-mask')`))) return Date.now() - t0
        await sleep(100)
      }
      return -1
    }
    await waitPanel(FROM, expF); await sleep(2000)

    // CPU 剖面:1ms 采样,覆盖整个切换
    await send('Profiler.enable')
    await send('Profiler.setSamplingInterval', { interval: 1000 })
    await send('Profiler.start')
    const t0 = Date.now()
    await evaluate(`location.hash='#/panelx/list/${TO}'; 'ok'`)
    const took = await waitPanel(TO, expT)
    const prof = (await send('Profiler.stop')).result.profile
    console.log(`\n${FROM} → ${TO}:就绪 ${took}ms,剖面覆盖 ${Date.now() - t0}ms,样本 ${prof.samples.length}`)

    // self-time 聚合
    const byId = new Map(prof.nodes.map((n) => [n.id, n]))
    const self = new Map()   // nodeId -> µs
    for (let i = 0; i < prof.samples.length; i++) {
      const id = prof.samples[i]; const dt = prof.timeDeltas[i] || 0
      self.set(id, (self.get(id) || 0) + dt)
    }
    const byFn = new Map(); const byUrl = new Map()
    let total = 0
    for (const [id, us] of self) {
      const n = byId.get(id); if (!n) continue
      total += us
      const f = n.callFrame
      const fk = `${f.functionName || '(anon)'} @ ${shortUrl(f.url)}:${f.lineNumber + 1}`
      byFn.set(fk, (byFn.get(fk) || 0) + us)
      const uk = shortUrl(f.url)
      byUrl.set(uk, (byUrl.get(uk) || 0) + us)
    }
    const ms = (us) => (us / 1000).toFixed(1)
    console.log(`样本总耗时 ${ms(total)}ms\n\n=== TOP 25 函数(self) ===`)
    for (const [k, v] of [...byFn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25))
      console.log(`  ${ms(v).padStart(7)}ms  ${k}`)
    console.log('\n=== TOP 12 模块(url,self 汇总) ===')
    for (const [k, v] of [...byUrl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12))
      console.log(`  ${ms(v).padStart(7)}ms  ${k}`)

    function shortUrl(u) {
      if (!u) return '(native/无源)'
      const m = u.match(/\/assets\/([^/?#]+)/) || u.match(/\/src\/(.*)$/)
      return m ? m[1].slice(0, 60) : u.slice(-60)
    }
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
}
main().catch((e) => { console.error('[FATAL] ' + e.message); process.exit(1) })
