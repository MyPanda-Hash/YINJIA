/* 诊断⑨(真实鼠标):登录 → WHLOC → 工具栏「新增」 → 真实坐标点 库位编码 单元格 → 真实键盘打字
   全程 CDP Input.dispatchMouseEvent/dispatchKeyEvent(走浏览器原生命中测试,与人手一致) */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require(path.join(__dirname, '..', 'node_modules', 'ws'))

const PORT = 9363
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const HELPERS = `
window.__mainTable = function(){ return [].slice.call(document.querySelectorAll('.el-table')).filter(function(t){return !t.closest('.el-dialog')})[0] };
window.__mainDataRows = function(){ var t=window.__mainTable(); if(!t) return []; return [].slice.call(t.querySelectorAll('.el-table__row')).filter(function(r){return r.querySelector('.cell-lazy, .inline-ref-editor, td .el-input, td .el-select, td .el-switch')}) };
window.__cellOf = function(label,rowIdxFromEnd){ var t=window.__mainTable(); if(!t) return null; var ths=[].slice.call(t.querySelectorAll('.el-table__header th')); var idx=-1; ths.forEach(function(th,i){ if((th.textContent||'').indexOf(label)>=0 && idx<0) idx=i }); if(idx<0) return null; var rs=window.__mainDataRows(); var tr=rs.length?rs[(rowIdxFromEnd!==undefined? rs.length-1-rowIdxFromEnd : rs.length-1)]:null; if(!tr) return null; var tds=tr.querySelectorAll('td'); return tds[idx]||null };
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

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-real-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,900', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const newRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
    const tab = await newRes.json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    const errors = []
    ws.on('message', (data) => {
      let m; try { m = JSON.parse(data.toString()) } catch { return }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push((m.params.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 250))
      if (m.method === 'Runtime.exceptionThrown') errors.push('EXC:' + ((m.params.exceptionDetails || {}).text || ''))
    })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evalOnce = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result && r.result.exceptionDetails) return 'EVAL_ERR:' + JSON.stringify(r.result.exceptionDetails).slice(0, 200)
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 50; i++) { await sleep(200); if (await evalOnce('document.readyState') === 'complete') { await sleep(700); return } }
    }
    // 真实鼠标点击(坐标):按下+释放,走原生命中测试
    const realClick = async (x, y) => {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 })
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
      await sleep(60)
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
    }
    const clickCenter = async (jsonRect) => {
      const r = JSON.parse(jsonRect)
      await realClick(Math.round(r.x), Math.round(r.y))
    }
    const pressKey = async (ch) => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch, code: 'Key' + ch.toUpperCase(), unmodifiedText: ch })
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, code: 'Key' + ch.toUpperCase() })
    }

    await send('Page.enable'); await send('Runtime.enable')
    await navigate(`${BASE}/#/login`)
    await evalOnce(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')
    await navigate(`${BASE}/#/panelx/list/WHLOC`)
    for (let i = 0; i < 40; i++) { await sleep(300); if (await evalOnce(`document.querySelectorAll('.el-table__row').length`) > 0) break }
    await sleep(1200)
    await evalOnce(HELPERS)

    // 现状快照:数据行数 + 各列可编辑元素
    console.log('现状:', await evalOnce(`(function(){var rs=window.__mainDataRows();var t=window.__mainTable();return JSON.stringify({dataRows:rs.length,allRows:t.querySelectorAll('.el-table__row').length,新增数据按钮: !![].slice.call(document.querySelectorAll('button,span')).find(function(x){return (x.textContent||'').trim()==='新增数据'})})})()`))

    // ① 真实点击工具栏「新增」(span 渲染,坐标点击)
    const addBtn = await evalOnce(`(function(){var els=[].slice.call(document.querySelectorAll('button,span'));var el=els.find(function(x){return (x.textContent||'').trim()==='新增'});return window.__rect(el)})()`)
    console.log('① 工具栏新增 rect:', addBtn)
    if (addBtn && String(addBtn).startsWith('{')) { await clickCenter(addBtn); await sleep(900) }
    console.log('   点击后 toast:', await evalOnce('window.__toasts()'))
    console.log('   点击后 数据行:', await evalOnce('(function(){return window.__mainDataRows().length})()'))

    // ② 真实坐标点击 第一数据行 的 库位编码 单元格中心
    const cellRect = await evalOnce('window.__rect(window.__cellOf("库位编码", 0))')
    console.log('② 库位编码 单元格 rect:', cellRect)
    if (cellRect && String(cellRect).startsWith('{')) {
      await clickCenter(cellRect)
      await sleep(500)
      console.log('   点击后:', await evalOnce('window.__cellState("库位编码")'))
      // ③ 再点一次(若首击只激活了 cell-lazy,编辑器内 input 需要再点进)
      const r2 = await evalOnce('window.__rect(window.__cellOf("库位编码", 0))')
      if (r2 && String(r2).startsWith('{')) { await clickCenter(r2); await sleep(400) }
      console.log('③ 二击后:', await evalOnce('window.__cellState("库位编码")'))
      // ④ 真实键盘连打
      for (const ch of ['T', 'E', 'S', 'T']) {
        await pressKey(ch)
        await sleep(320)
        console.log(`   按'${ch}' →`, await evalOnce('window.__cellState("库位编码")'))
      }
    }

    // ⑤ 库位地址同流程
    const addrRect = await evalOnce('window.__rect(window.__cellOf("库位地址", 0))')
    console.log('⑤ 库位地址 rect:', addrRect)
    if (addrRect && String(addrRect).startsWith('{')) {
      await clickCenter(addrRect); await sleep(500)
      const r3 = await evalOnce('window.__rect(window.__cellOf("库位地址", 0))')
      if (r3 && String(r3).startsWith('{')) { await clickCenter(r3); await sleep(400) }
      console.log('   二击后:', await evalOnce('window.__cellState("库位地址")'))
      for (const ch of ['Z', '9']) {
        await pressKey(ch)
        await sleep(320)
        console.log(`   按'${ch}' →`, await evalOnce('window.__cellState("库位地址")'))
      }
    }

    console.log('\nconsole 错误:', errors.length ? errors.slice(0, 6) : '无')
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
