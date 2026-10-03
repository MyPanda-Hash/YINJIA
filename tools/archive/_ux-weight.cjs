/* 全库渲染重量审查:逐面板量「切换耗时 / 行数 / 列数 / DOM 节点数 / 本次长任务」
   用法: node tools/archive/_ux-weight.cjs <面板清单文件> [基线地址]
   为什么:面板切换卡顿的根因分两类 —— 接口慢(看 apiMaxMs)与渲染重(看 DOM 节点/单元格数)。
           本探针把 172 个面板一次量完,给出"该优化的前 N 名"。
   判定就绪:DOM 层面(表格行/空态出现且 loading 遮罩消失),不依赖资源计数
             ⇒ 开发态(模块已缓存、无新资源)同样可测。 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const LIST = process.argv[2]
const BASE = process.argv[3] || 'http://127.0.0.1:8090'
const PORT = 9446
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const API = 'http://localhost:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  }).then((r) => r.json())
  const token = login.data.token, user = JSON.stringify(login.data.user)
  const panels = fs.readFileSync(LIST, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-w-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--window-size=1440,900`,
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable')
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `window.__lt=[];(function(){try{new PerformanceObserver(function(l){l.getEntries().forEach(function(e){window.__lt.push(Math.round(e.duration))})}).observe({entryTypes:['longtask']})}catch(e){}})();`,
    })
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

    await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1500)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(user)}); localStorage.setItem('mes_init_done','1'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
    await send('Page.navigate', { url: `${BASE}/#/dashboard` }); await sleep(3000)

    // 预期列数:路径已由 _calib-config.cjs 标定(browser 真值 SO_ORDER=16/INV=56/PURCHASE_IN=24;
    // 配置值偶有 ±1 差,故判据用容差 ±2 + 资源静默,而不是等号)
    const tokenH = { Authorization: `Bearer ${token}` }
    const expect = {}
    for (const p of panels) {
      try {
        const j = await fetch(`${API}/api/px/getPanelConfig?panelCode=${encodeURIComponent(p)}`, { headers: tokenH }).then((r) => r.json())
        const tabs = j.data?.metadata?.panelPageDto?.tablePages?.[0]?.gridTabs || []
        expect[p] = (tabs[0]?.columns || []).length
      } catch { expect[p] = -1 }
    }

    const rows = []
    for (const p of panels) {
      const rb = await evaluate(`performance.getEntriesByType('resource').length`)
      await evaluate(`window.__lt=[]; 'ok'`)
      const t0 = Date.now()
      await evaluate(`location.hash='#/panelx/list/${p}'; 'ok'`)
      const exp = expect[p]
      const QUIET = Number(process.env.UX_QUIET_MS || 0)   // 0 = 紧口径(无静默窗口,只用列数容差+loading 消失)
      const POLL = Number(process.env.UX_POLL_MS || 50)
      let ms = -1, last = rb, quietSince = Date.now()
      for (let i = 0; i < 240; i++) {
        const st = await evaluate(`JSON.stringify((()=>{const m=document.querySelector('.el-loading-mask');
          const th=document.querySelectorAll('.el-table__header th').length;
          const emp=document.querySelector('.el-empty');const r=performance.getEntriesByType('resource').length;
          return {th,emp:!!emp,loading:!!m,res:r};})())`)
        const s = JSON.parse(st)
        if (s.res !== last) { last = s.res; quietSince = Date.now() }
        const colOk = exp <= 0 ? (s.th === 0 && s.emp) : Math.abs(s.th - exp) <= 2
        if (colOk && !s.loading && Date.now() - quietSince >= QUIET) { ms = Date.now() - t0; break }
        await sleep(POLL)
      }
      await sleep(150) // 让本轮渲染/长任务落定,再采样
      const info = await evaluate(`JSON.stringify((()=>{const r=performance.getEntriesByType('resource').slice(${rb}).filter(x=>x.name.includes('/api/'));
        const th=document.querySelectorAll('.el-table__header th').length, tr=document.querySelectorAll('.el-table__row').length;
        return {api:r.length,apiMax:Math.max(0,...r.map(x=>Math.round(x.duration))),apiSum:r.reduce((a,b)=>a+Math.round(b.duration),0),
                rows:tr,cols:th,cells:tr*th,dom:document.querySelectorAll('*').length,
                ltN:(window.__lt||[]).length,ltMax:Math.max(0,...(window.__lt||[]))};})())`)
      rows.push({ p, exp, ms, ...JSON.parse(info) })
      process.stdout.write(`[${String(rows.length).padStart(3)}/${panels.length}] ${p.padEnd(24)} ${String(ms).padStart(5)}ms 列${String(JSON.parse(info).cols).padStart(3)}(期望${String(exp).padStart(3)}) 行${String(JSON.parse(info).rows).padStart(4)} 单元格${String(JSON.parse(info).cells).padStart(6)} DOM${String(JSON.parse(info).dom).padStart(6)} api${String(JSON.parse(info).api).padStart(3)} 长任务${JSON.parse(info).ltN}(最大${JSON.parse(info).ltMax}ms)\n`)
    }
    const top = (k, n, f) => rows.slice().sort((a, b) => (f ? f(b) : b[k]) - (f ? f(a) : a[k])).slice(0, n)
    console.log('\n=== 切换耗时最慢 TOP 12 ===')
    for (const r of top('ms', 12)) console.log(`  ${r.p.padEnd(22)} ${String(r.ms).padStart(5)}ms | 行${r.rows} 列${r.cols} DOM${r.dom} | api ${r.api} 条 最慢${r.apiMax}ms`)
    console.log('\n=== DOM 节点最多 TOP 12(渲染重量)===')
    for (const r of top('dom', 12)) console.log(`  ${r.p.padEnd(22)} DOM${String(r.dom).padStart(6)} | 行${String(r.rows).padStart(4)} 列${String(r.cols).padStart(3)} 单元格${String(r.cells).padStart(6)} | 切换${r.ms}ms`)
    console.log('\n=== 单元格数最多 TOP 12(宽表渲染)===')
    for (const r of top('cells', 12)) console.log(`  ${r.p.padEnd(22)} 单元格${String(r.cells).padStart(6)}(行${r.rows}×列${r.cols}) | DOM${r.dom} 切换${r.ms}ms`)
    console.log('\n=== 接口调用最多的 TOP 10(前端请求放大)===')
    for (const r of top('api', 10)) console.log(`  ${r.p.padEnd(22)} /api ${String(r.api).padStart(3)} 条 合计${String(r.apiSum).padStart(5)}ms 最慢${r.apiMax}ms`)
    fs.writeFileSync(path.join(os.tmpdir(), '_ux-weight.json'), JSON.stringify(rows, null, 1))
    console.log('\n明细已写 ' + path.join(os.tmpdir(), '_ux-weight.json'))
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
}
main().catch((e) => { console.error('[FATAL] ' + e.message); process.exit(1) })
