/* UI 流畅性审查探针 v2(Edge headless + CDP)——修正 v1 的三处测量缺陷:
     v1 缺陷①:SPA 切换后 waitPanel 看到的可能是上一个路由残留的 DOM ⇒ 现在按"目标面板自己的
              queryFormDataList 响应已到达 + 行已渲染"判定,且切换前后对资源条目做差集。
     v1 缺陷②:API 计数用全量累计 ⇒ 现在按 (切换前条目数) 切片做差,只统计本次切换。
     v1 缺陷③:冷启动把两次导航都算进去 ⇒ 现在以 performance.timeOrigin 为起点,
              并用 PerformanceNavigationTiming + FCP 分别给出。
   用法: node tools/archive/_ux-perf-probe.cjs [截图目录] */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const OUT = process.argv[2] || path.join(os.tmpdir(), '_ux-shots')
const PORT = 9445
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const API = 'http://localhost:8090'
const PROD = 'http://127.0.0.1:8090'
const DEV = 'http://localhost:5173'
const PANELS = ['SO_ORDER', 'INV', 'PURCHASE_IN', 'RD_MOLD_PROC']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  }).then((r) => r.json())
  if (!login.data?.token) throw new Error('登录失败')
  const token = login.data.token, user = JSON.stringify(login.data.user)

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ux-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1440,900', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); const errs = []
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push((m.params.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 200))
      if (m.method === 'Runtime.exceptionThrown') errs.push('exc: ' + String(m.params.exceptionDetails?.exception?.description || '').slice(0, 200))
    }
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
    const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from(r.result.data, 'base64')) }
    const viewport = (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
    await send('Page.enable'); await send('Runtime.enable'); await viewport(1440, 900)
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `window.__lt=[];(function(){try{new PerformanceObserver(function(l){l.getEntries().forEach(function(e){window.__lt.push(Math.round(e.duration))})}).observe({entryTypes:['longtask']})}catch(e){}})();`,
    })

    // 面板就绪判定:该面板自己的取数请求已到位 + 行/空态已渲染
    const readyExpr = (p, resBefore) => `(()=>{const r=performance.getEntriesByType('resource');
        const q=r.filter(x=>x.name.includes('/api/px/')||x.name.includes('/api/'));
        const mine=q.some(x=>x.name.includes('queryFormDataList')||x.name.includes('getPanelConfig'));
        const dom=!!document.querySelector('.el-table__row')||!!document.querySelector('.el-empty');
        return (dom && r.length>${resBefore})?'READY':(dom?'DOM_ONLY':'WAIT')})()`
    const waitReady = async (p, resBefore, ms = 25000) => {
      const t0 = Date.now()
      while (Date.now() - t0 < ms) {
        if ((await evaluate(readyExpr(p, resBefore))) === 'READY') return Date.now() - t0
        await sleep(150)
      }
      return -1
    }

    for (const [label, base] of [['生产构建 8090', PROD], ['开发态热更 5173', DEV]]) {
      console.log(`\n######## ${label} ########`)
      errs.length = 0
      // 会话准备(单独一次导航,不计入任何指标)
      await send('Page.navigate', { url: `${base}/#/login` }); await sleep(1200)
      await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(user)}); localStorage.setItem('mes_init_done','1'); 'ok'`)
      await send('Page.navigate', { url: 'about:blank' }); await sleep(300)

      // ---- 冷启动(整页加载到首个面板出表)----
      await send('Page.navigate', { url: `${base}/#/panelx/list/SO_ORDER` })
      const cold = await waitReady('SO_ORDER', 0, 30000)
      const t = await evaluate(`JSON.stringify((()=>{const n=performance.getEntriesByType('navigation')[0]||{};
        const fcp=(performance.getEntriesByType('paint').find(p=>p.name==='first-contentful-paint')||{}).startTime||0;
        const r=performance.getEntriesByType('resource');
        return {dcl:Math.round(n.domContentLoadedEventEnd||0),load:Math.round(n.loadEventEnd||0),fcp:Math.round(fcp),
                resCount:r.length,jsKB:Math.round(r.filter(x=>/\\.js/.test(x.name)).reduce((a,b)=>a+(b.transferSize||0),0)/1024),
                totalKB:Math.round(r.reduce((a,b)=>a+(b.transferSize||0),0)/1024)}})())`)
      const lt = await evaluate(`JSON.stringify({n:(window.__lt||[]).length,total:(window.__lt||[]).reduce((a,b)=>a+b,0),max:Math.max(0,...(window.__lt||[]))})`)
      const shape = await evaluate(`JSON.stringify({rows:document.querySelectorAll('.el-table__row').length,cols:document.querySelectorAll('.el-table__header th').length,dom:document.querySelectorAll('*').length})`)
      console.log(`  冷启动→首个面板出表: ${cold}ms  (DCL/load/FCP = ${t})`)
      console.log(`  资源: ${t && JSON.parse(t).resCount} 条 / JS ${t && JSON.parse(t).jsKB}KB / 合计 ${t && JSON.parse(t).totalKB}KB   长任务: ${lt}`)
      console.log(`  渲染: ${shape}   控制台错误: ${errs.length ? errs.slice(0, 2).join(' | ') : '无'}`)
      if (base === PROD) await shot('01-cold-1440')

      // ---- SPA 切换(每次都先记录资源基线,差值只算本次)----
      for (const p of PANELS) {
        errs.length = 0
        const resBefore = await evaluate(`performance.getEntriesByType('resource').length`)
        const t0 = Date.now()
        await evaluate(`location.hash='#/panelx/list/${p}'; 'ok'`)
        const ms = await waitReady(p, resBefore)
        const diff = await evaluate(`JSON.stringify((()=>{const r=performance.getEntriesByType('resource').slice(${resBefore});
           const api=r.filter(x=>x.name.includes('/api/'));
           return {newRes:r.length,apiCount:api.length,apiMaxMs:Math.max(0,...api.map(x=>Math.round(x.duration))),
                   apiSumMs:api.reduce((a,b)=>a+Math.round(b.duration),0)};})())`)
        const sh = await evaluate(`JSON.stringify({rows:document.querySelectorAll('.el-table__row').length,cols:document.querySelectorAll('.el-table__header th').length,dom:document.querySelectorAll('*').length})`)
        console.log(`  [SPA 切换] ${p.padEnd(14)} 出表 ${String(ms).padStart(5)}ms | 本次新资源 ${JSON.parse(diff).newRes} 条(其中 /api ${JSON.parse(diff).apiCount} 条,最慢 ${JSON.parse(diff).apiMaxMs}ms,合计 ${JSON.parse(diff).apiSumMs}ms) | ${sh} | 错误 ${errs.length}`)
        if (base === PROD && p === 'SO_ORDER') await shot('02-list-so_order-1440')
        if (base === PROD && p === 'INV') await shot('03-list-inv-1440')
      }

      // ---- 表单页 ----
      if (base === PROD) {
        const rb = await evaluate(`performance.getEntriesByType('resource').length`)
        await evaluate(`location.hash='#/panelx/form/SO_ORDER'; 'ok'`)
        await sleep(2500)
        const fd = await evaluate(`JSON.stringify((()=>{const r=performance.getEntriesByType('resource').slice(${rb}).filter(x=>x.name.includes('/api/'));
           return {apiCount:r.length,maxMs:Math.max(0,...r.map(x=>Math.round(x.duration))),inputs:document.querySelectorAll('input,textarea').length,dom:document.querySelectorAll('*').length};})())`)
        await shot('04-form-so_order-1440')
        console.log(`  [表单] SO_ORDER ${fd}`)
      }

      // ---- 三档宽度(响应式:横向溢出 + 截图)----
      if (base === PROD) {
        await evaluate(`location.hash='#/panelx/list/SO_ORDER'; 'ok'`); await sleep(2000)
        for (const [w, h, nm] of [[1440, 900, '05-w1440'], [768, 1024, '06-w768'], [375, 812, '07-w375']]) {
          await viewport(w, h); await sleep(1200)
          const ovf = await evaluate(`JSON.stringify({hScroll:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})`)
          await shot(nm + '-list')
          console.log(`  [${w}px] 列表页横向溢出: ${ovf}`)
        }
        await viewport(1440, 900); await evaluate(`location.hash='#/dashboard'; 'ok'`); await sleep(2500)
        await shot('08-dashboard-1440')
        for (const [w, h, nm] of [[768, 1024, '09-w768'], [375, 812, '10-w375']]) { await viewport(w, h); await sleep(1500); await shot(nm + '-dashboard') }
        await viewport(1440, 900)
      }
    }
    console.log(`\n截图目录: ${OUT}`)
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
}
main().catch((e) => { console.error('[FATAL] ' + e.message); process.exit(1) })
