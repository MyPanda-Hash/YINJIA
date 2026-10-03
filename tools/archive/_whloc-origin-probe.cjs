/* 诊断⑥:仓库列编辑器来源判定 —— 单元格容器类名 + activeCell + singleDocMode 同时读取 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require(path.join(__dirname, '..', 'node_modules', 'ws'))

const PORT = 9357
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const login = await loginRes.json()

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-origin-'))
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
      if (r.result && r.result.exceptionDetails) return 'EVAL_ERR:' + JSON.stringify(r.result.exceptionDetails).slice(0, 300)
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 50; i++) { await sleep(200); if (await evalOnce('document.readyState') === 'complete') { await sleep(600); return } }
    }
    await send('Page.enable')
    await navigate(`${BASE}/#/login`)
    await evalOnce(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')
    await navigate(`${BASE}/#/panelx/list/WHLOC`)
    for (let i = 0; i < 40; i++) { await sleep(300); if (await evalOnce(`document.querySelectorAll('.el-table__row').length`) > 0) break }
    await sleep(1500)

    const out = await evalOnce(`(function(){
      var el = document.querySelector('.el-table');
      var inst = el && el.__vueParentComponent;
      var ss = null, hops = 0;
      while (inst && hops < 25) { if (inst.setupState && ('cfgCache' in inst.setupState)) { ss = inst.setupState; break } inst = inst.parent; hops++ }
      var ac = ss && ss.activeCell ? JSON.parse(JSON.stringify(ss.activeCell)) : null;
      var trs=[].slice.call(document.querySelectorAll('.el-table__row')).slice(0,3);
      var rowsInfo = trs.map(function(tr){
        var tds=[].slice.call(tr.querySelectorAll('td'));
        var col1=tds[1];
        var wrap = col1 ? (col1.querySelector('.inline-ref-editor') || col1.querySelector('.cell-lazy') || col1.querySelector('.el-input') || col1.querySelector('.el-select')) : null;
        return {
          col1Class: wrap ? String(wrap.className).slice(0,40) : '(none)',
          col1Text: col1 ? (col1.textContent||'').trim().slice(0,14) : '',
          col2Kind: tds[2] ? (tds[2].querySelector('input')?'EDITOR':'span') : '',
          classes: col1 ? String(col1.className).slice(0,30) : '',
        };
      });
      return JSON.stringify({
        singleDocMode: ss && ss.singleDocMode ? String(ss.singleDocMode) : '?',
        activeCell: ac,
        detailRefPick: ss && ss.detailRefPick ? 'set' : String(ss && ss.detailRefPick),
        detailRefVisible: ss ? String(ss.detailRefVisible && (ss.detailRefVisible.value !== undefined ? ss.detailRefVisible.value : ss.detailRefVisible)) : '?',
        rows: rowsInfo,
      })
    })()`)
    console.log('WHLOC 运行时:', out)
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
