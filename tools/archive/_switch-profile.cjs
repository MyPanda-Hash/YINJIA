/* 面板切换耗时拆解(CDP):把一次切换拆成
     网络等待(config/查询等接口) / 脚本执行 / 样式重算 / 布局 / 绘制
   用法: node tools/archive/_switch-profile.cjs INV [基线地址] [重复次数]
   原理:Performance.getMetrics 取累计计数器做差(脚本/布局/样式),资源时序定位每个接口的到达时刻,
        列数容差判就绪(口径同 _ux-weight.cjs,已标定)。 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const PANEL = process.argv[2] || 'INV'
const BASE = process.argv[3] || 'http://127.0.0.1:8090'
const ROUNDS = Number(process.argv[4] || 3)
const PORT = 9449
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const API = 'http://localhost:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  }).then((r) => r.json())
  const token = login.data.token, user = JSON.stringify(login.data.user)
  const cfg = await fetch(`${API}/api/px/getPanelConfig?panelCode=${PANEL}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())
  const expect = (cfg.data?.metadata?.panelPageDto?.tablePages?.[0]?.gridTabs?.[0]?.columns || []).length

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-p-'))
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
    await send('Page.enable'); await send('Runtime.enable'); await send('Performance.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1500)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(user)}); localStorage.setItem('mes_init_done','1'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
    // 先落到一个**不同于目标**的起点面板(否则 hash 不变 = 假就绪、0 请求)
    const START = PANEL === 'SO_ORDER' ? 'INV' : 'SO_ORDER'
    await send('Page.navigate', { url: `${BASE}/#/panelx/list/${START}` }); await sleep(4500)

    for (let r = 1; r <= ROUNDS; r++) {
      await evaluate(`location.hash='#/panelx/list/${START}'; 'ok'`); await sleep(2500)
      await evaluate(`performance.clearResourceTimings(); 'ok'`)
      const before = await send('Performance.getMetrics')
      const b = Object.fromEntries(before.result.metrics.map((x) => [x.name, x.value]))
      const t0 = await evaluate(`performance.now()`)          // 与资源时序同一时钟(timeOrigin 基准)
      await evaluate(`location.hash='#/panelx/list/${PANEL}'; 'ok'`)
      let ms = -1
      for (let i = 0; i < 240; i++) {
        const s = JSON.parse(await evaluate(`JSON.stringify((()=>{const m=document.querySelector('.el-loading-mask');
          const th=document.querySelectorAll('.el-table__header th').length;
          return {th, loading:!!m};})())`))
        if (Math.abs(s.th - expect) <= 2 && !s.loading) { ms = (await evaluate(`performance.now()`)) - t0; break }
        await sleep(25)
      }
      const after = await send('Performance.getMetrics')
      const a = Object.fromEntries(after.result.metrics.map((x) => [x.name, x.value]))
      const d = (k) => Math.round(((a[k] || 0) - (b[k] || 0)) * 1000)   // 秒 → ms
      // ⚠ 资源 startTime/responseEnd 是相对 timeOrigin 的绝对值 ⇒ 必须减 t0 才是"相对本次切换"
      const res = JSON.parse(await evaluate(`JSON.stringify(performance.getEntriesByType('resource').filter(x=>x.name.includes('/api/')).map(x=>({n:x.name.split('/api/')[1].split('?')[0], start:Math.round(x.startTime-${t0}), end:Math.round(x.responseEnd-${t0}), ms:Math.round(x.duration)})))`))
      const apis = {}
      for (const x of res) apis[x.n] = (apis[x.n] || 0) + 1
      const firstStart = res.length ? Math.min(...res.map((x) => x.start)) : 0
      const lastEnd = res.length ? Math.max(...res.map((x) => x.end)) : 0
      const task = d('TaskDuration'), script = d('ScriptDuration'), style = d('RecalcStyleDuration'), layout = d('LayoutDuration')
      console.log(`\n===== 第 ${r} 轮:${START} → ${PANEL}(期望 ${expect} 列)=====`)
      console.log(`  总耗时(到渲染就绪): ${Math.round(ms)}ms`)
      console.log(`  /api ${res.length} 个:${JSON.stringify(apis)}`)
      console.log(`  网络:首个请求 +${firstStart}ms 发出、最后一个响应 +${lastEnd}ms 到达`)
      console.log(`  主线程:Task=${task}ms(Script ${script} + Layout ${layout} + RecalcStyle ${style})`)
      console.log(`  拆分:网络/等待 ≈ ${lastEnd}ms,响应后到就绪 ≈ ${Math.round(ms - lastEnd)}ms,主线程占用 ${task}ms`)
      console.log(`  计数:LayoutCount=${a.LayoutCount - b.LayoutCount} RecalcStyleCount=${a.RecalcStyleCount - b.RecalcStyleCount} 节点=${a.Nodes - b.Nodes} JS堆=${Math.round((a.JSHeapUsedSize - b.JSHeapUsedSize) / 1024 / 1024 * 10) / 10}MB`)
    }
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
}
main().catch((e) => { console.error('[FATAL] ' + e.message); process.exit(1) })
