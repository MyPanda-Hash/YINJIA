/* 批量面板 UI 冒烟:打开各模块代表面板,捕获 console 报错,确认页面可用 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('ws')
const PORT = 9341
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// 覆盖全部模块的代表面板
const PANELS = [
  'SO_ORDER', 'PU_REQ', 'PU_ORDER', 'PURCHASE_IN', 'SALE_OUT', 'OTHER_IN', 'OTHER_OUT',
  'OUTSOURCE_ORDER', 'OUTSOURCE_ISSUE', 'OUTSOURCE_IN', 'MATERIAL_OUT', 'FINISH_IN',
  'MANU_ORDER', 'DISPATCH', 'RD_FILTER_EFF', 'RD_INSTR_USE', 'DEPT', 'WH', 'EMP', 'PARTNER', 'INV', 'OP', 'BOM', 'STOCK_STATUS',
]

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })
  const login = await loginRes.json()
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ui-all-'))
  const edge = spawn(EDGE, ['--headless=new','--disable-gpu','--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const newRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
    const tab = await newRes.json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i=0;i<50;i++) { await sleep(300); if (await evaluate('document.readyState')==='complete') { await sleep(600); return } } }
    await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable')

    // 收集页面错误(console error + 未捕获异常)
    const errors = []
    ws.on('message', (data) => {
      try {
        const m = JSON.parse(data.toString())
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
          errors.push('console: ' + (m.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 300))
        }
        if (m.method === 'Runtime.exceptionThrown') {
          errors.push('exception: ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || '').slice(0, 300))
        }
      } catch {}
    })

    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); 'ok'`)
    await navigate('about:blank')

    const results = []
    for (const p of PANELS) {
      errors.length = 0
      await navigate(`http://localhost:5173/#/panelx/list/${p}`)
      await sleep(3500)
      const title = await evaluate('document.title') || ''
      // 页面是否渲染了表格(或空态)
      const hasTable = await evaluate(`!!document.querySelector('.el-table') || !!document.querySelector('.el-empty')`)
      // 过滤掉与面板无关的既有噪音(如 webpack/vite HMR),只留真实错误
      const real = errors.filter(e => !e.includes('favicon') && !e.includes('WebSocket connection') && !e.includes('vite') && !e.includes('[Vue warn]'))
      const status = real.length === 0 && hasTable ? 'OK' : (real.length ? 'ERR' : 'NO-RENDER')
      results.push({ p, title: title.replace(' · YINJIA-MES', ''), status, errors: real })
      console.log(`[${status}] ${p} | title=${title.replace(' · YINJIA-MES', '')}`)
      if (real.length) real.forEach(e => console.log('     ', e))
    }

    const bad = results.filter(r => r.status !== 'OK')
    console.log('=== SUMMARY ===')
    console.log(`total=${results.length} ok=${results.length - bad.length} bad=${bad.length}`)
    if (bad.length) bad.forEach(r => console.log(`BAD ${r.p}: ${r.status}`))
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile,{recursive:true,force:true}) } catch {} }
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
