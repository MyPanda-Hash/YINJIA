/* 诊断⑤:从运行中的 Vue 组件读 cfgCache.metadata.singleDoc / singleDocMode 真值 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require(path.join(__dirname, '..', 'node_modules', 'ws'))

const PORT = 9355
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const login = await loginRes.json()

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-vuestate-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const newRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
    const tab = await newRes.json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.on('message', (data) => {
      let m; try { m = JSON.parse(data.toString()) } catch { return }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evalOnce = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result && r.result.exceptionDetails) return 'EVAL_ERR:' + JSON.stringify(r.result.exceptionDetails).slice(0, 200)
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 50; i++) { await sleep(200); if (await evalOnce('document.readyState') === 'complete') { await sleep(600); return } }
    }
    await send('Page.enable')
    await navigate(`${BASE}/#/login`)
    await evalOnce(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)

    for (const p of ['WHLOC', 'INV']) {
      await navigate('about:blank')
      await navigate(`${BASE}/#/panelx/list/${p}`)
      for (let i = 0; i < 40; i++) { await sleep(300); if (await evalOnce(`document.querySelectorAll('.el-table__row').length`) > 0) break }
      await sleep(1500)
      const state = await evalOnce(`(function(){
        // 从表格 DOM 向上找持有 cfgCache 的组件实例
        var el = document.querySelector('.el-table');
        var inst = el && el.__vueParentComponent;
        var hops = 0;
        while (inst && hops < 25) {
          var ss = inst.setupState || {};
          if ('cfgCache' in ss || 'singleDocMode' in ss) {
            var cfg = ss.cfgCache;
            return JSON.stringify({
              found: inst.type.__name || inst.type.name || '?',
              singleDocInMeta: cfg && cfg.metadata ? cfg.metadata.singleDoc : 'NO_METADATA',
              singleDocModeComputed: ss.singleDocMode ? String(ss.singleDocMode) : 'NO_COMPUTED',
              panelCode: ss.panelCode ? String(ss.panelCode.value !== undefined ? ss.panelCode.value : ss.panelCode) : '?',
              metaKeys: cfg && cfg.metadata ? Object.keys(cfg.metadata).join(',') : '',
            });
          }
          inst = inst.parent; hops++;
        }
        return 'NOT_FOUND hops=' + hops;
      })()`)
      console.log(`[${p}]`, state)
      // 同时在页面内直接 fetch 配置对照(同一 token 同一页)
      const apiInPage = await evalOnce(`(async function(){var t=localStorage.getItem('mes_token');var r=await fetch('/api/px/getPanelConfig?panelCode=${p}',{headers:{Authorization:'Bearer '+t}});var j=await r.json();return JSON.stringify({apiSingleDoc:j.data&&j.data.metadata?j.data.metadata.singleDoc:'?',apiMetaKeys:j.data&&j.data.metadata?Object.keys(j.data.metadata).join(','):''})})()`)
      console.log(`[${p}] 页内 API:`, apiInPage)
    }
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
