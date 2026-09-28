/* 诊断⑪(闭环证明):关掉初始化向导 → 真实坐标点击/打字 全部恢复 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require(path.join(__dirname, '..', 'node_modules', 'ws'))

const PORT = 9367
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const HELPERS = `
window.__mainTable = function(){ return [].slice.call(document.querySelectorAll('.el-table')).filter(function(t){return !t.closest('.el-dialog')})[0] };
window.__mainDataRows = function(){ var t=window.__mainTable(); if(!t) return []; return [].slice.call(t.querySelectorAll('.el-table__row')).filter(function(r){return r.querySelector('.cell-lazy, .inline-ref-editor, td .el-input, td .el-select, td .el-switch')}) };
window.__cellOf = function(label){ var t=window.__mainTable(); if(!t) return null; var ths=[].slice.call(t.querySelectorAll('.el-table__header th')); var idx=-1; ths.forEach(function(th,i){ if((th.textContent||'').indexOf(label)>=0 && idx<0) idx=i }); if(idx<0) return null; var rs=window.__mainDataRows(); var tr=rs.length?rs[rs.length-1]:null; if(!tr) return null; var tds=tr.querySelectorAll('td'); return tds[idx]||null };
window.__rect = function(el){ if(!el) return null; var r=el.getBoundingClientRect(); return JSON.stringify({x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}) };
window.__cellState = function(label){ var td=window.__cellOf(label); if(!td) return 'NO_TD'; var inp=td.querySelector('input'); var ae=document.activeElement; return JSON.stringify({editor:!!inp,val:inp?String(inp.value).slice(0,14):(td.textContent||'').trim().slice(0,14),focusIn:!!td.contains(ae)}) };
window.__toasts = function(){ return [].slice.call(document.querySelectorAll('.el-message')).map(function(m){return (m.textContent||'').trim()}).join(' | ') };
`

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const login = await loginRes.json()

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-close-wiz-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,900', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
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
      if (r.result && r.result.exceptionDetails) return 'EVAL_ERR:' + JSON.stringify(r.result.exceptionDetails).slice(0, 150)
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 50; i++) { await sleep(200); if (await evalOnce('document.readyState') === 'complete') { await sleep(700); return } }
    }
    const realClick = async (x, y) => {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 })
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
      await sleep(60)
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
    }
    const clickCenter = async (jsonRect) => { const r = JSON.parse(jsonRect); await realClick(Math.round(r.x), Math.round(r.y)) }
    const pressKey = async (ch) => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch, code: 'Key' + ch.toUpperCase(), unmodifiedText: ch })
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, code: 'Key' + ch.toUpperCase() })
    }

    await send('Page.enable')
    await navigate(`${BASE}/#/login`)
    await evalOnce(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')
    await navigate(`${BASE}/#/panelx/list/WHLOC`)
    for (let i = 0; i < 40; i++) { await sleep(300); if (await evalOnce(`document.querySelectorAll('.el-table__row').length`) > 0) break }
    await sleep(1200)
    await evalOnce(HELPERS)

    console.log('向导在否:', await evalOnce(`!!document.querySelector('.wizard-mask')`))

    // ① 真实点击向导右上角 ✕(wz-close)
    const closeRect = await evalOnce(`window.__rect(document.querySelector('.wizard-mask .wz-close'))`)
    console.log('① 向导✕ rect:', closeRect)
    if (closeRect && String(closeRect).startsWith('{')) { await clickCenter(closeRect); await sleep(700) }
    console.log('   关闭后向导在否:', await evalOnce(`!!document.querySelector('.wizard-mask')`), '| mes_init_done =', await evalOnce(`localStorage.getItem('mes_init_done')`))

    // ② 真实点击工具栏 新增 → 应出 toast「请在下方列表页直接填写并保存」
    const addRect = await evalOnce(`(function(){var els=[].slice.call(document.querySelectorAll('button,span'));var el=els.find(function(x){return (x.textContent||'').trim()==='新增'});return window.__rect(el)})()`)
    if (addRect && String(addRect).startsWith('{')) { await clickCenter(addRect); await sleep(700) }
    console.log('② 工具栏新增 toast:', await evalOnce('window.__toasts()'))

    // ③ 真实点击 新增数据 → 行数应 +1
    const before = await evalOnce('(function(){return window.__mainDataRows().length})()')
    const addDataRect = await evalOnce(`(function(){var els=[].slice.call(document.querySelectorAll('button,span'));var el=els.find(function(x){return (x.textContent||'').trim()==='新增数据'});return window.__rect(el)})()`)
    if (addDataRect && String(addDataRect).startsWith('{')) { await clickCenter(addDataRect); await sleep(600) }
    const after = await evalOnce('(function(){return window.__mainDataRows().length})()')
    console.log('③ 新增数据: 行数', before, '→', after)

    // ④ 真实点击最后一行 库位编码 → 编辑器应挂载;再点一次进输入框 → 真实键盘连打
    const cell = await evalOnce('window.__rect(window.__cellOf("库位编码"))')
    if (cell && String(cell).startsWith('{')) {
      await clickCenter(cell); await sleep(450)
      console.log('④ 一击后:', await evalOnce('window.__cellState("库位编码")'))
      const c2 = await evalOnce('window.__rect(window.__cellOf("库位编码"))')
      if (c2 && String(c2).startsWith('{')) { await clickCenter(c2); await sleep(400) }
      console.log('   二击后:', await evalOnce('window.__cellState("库位编码")'))
      for (const ch of ['Q', '7']) {
        await pressKey(ch); await sleep(320)
        console.log(`   按'${ch}' →`, await evalOnce('window.__cellState("库位编码")'))
      }
    }

    // ⑤ 库位地址
    const addr = await evalOnce('window.__rect(window.__cellOf("库位地址"))')
    if (addr && String(addr).startsWith('{')) {
      await clickCenter(addr); await sleep(450)
      const a2 = await evalOnce('window.__rect(window.__cellOf("库位地址"))')
      if (a2 && String(a2).startsWith('{')) { await clickCenter(a2); await sleep(400) }
      console.log('⑤ 库位地址二击后:', await evalOnce('window.__cellState("库位地址")'))
      for (const ch of ['C', '3']) {
        await pressKey(ch); await sleep(320)
        console.log(`   按'${ch}' →`, await evalOnce('window.__cellState("库位地址")'))
      }
    }
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
