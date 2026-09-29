/* 未用表清理专项冒烟(任务产物):覆盖「本次删表边界」上的面板——
   ① 仍绑定经典遗留表的面板(inh/outh/order_bt/order_bs/Porder/dm_kh/dm_gf/mate/gxgs/scjl/kucun/s_log);
   ② 本次补了 备用1..20 的表所挂面板(day_report/mix_record/gran_record/wh_record/pack_confirm/
      sample_req/maint_plan/equip_check/feed_confirm/rod_return/sl_recv/erp_imp_log);
   ③ 被删面板的邻居(同模块在运营面板)。
   用法(在 tools 目录下):node archive\_legacy-panels-smoke.cjs */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('ws')
const PORT = 9343
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const PANELS = [
  'RKD', 'CKD', 'KHDD', 'KHDA', 'GFDA', 'WLBOM', 'OP_TIME', 'WO_REPORT_LIST', 'WO_PROGRESS',
  'QC_RECV', 'DAY_REPORT', 'MIX_RECORD', 'GRAN_RECORD', 'WH_RECORD', 'PACK_CONFIRM', 'SAMPLE_REQ',
  'MAINT_PLAN', 'EQUIP_CHECK', 'FEED_CONFIRM', 'ROD_RETURN', 'ERPLG', 'ZDGL', 'WC', 'INV_PRICE',
  'FIN_ACC', 'DISPATCH_DETAIL', 'PURCHASE_IN_STATS', 'STOCK_LEDGER', 'LOT_TRACE', 'WO_KIT',
]

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })
  const login = await loginRes.json()
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ui-legacy-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
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
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 50; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(600); return } } }
    await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable')

    const errors = []
    ws.on('message', (data) => {
      try {
        const m = JSON.parse(data.toString())
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console: ' + (m.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 300))
        if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || '').slice(0, 300))
      } catch { }
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
      const hasTable = await evaluate(`!!document.querySelector('.el-table') || !!document.querySelector('.el-empty')`)
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
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch { } }
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
