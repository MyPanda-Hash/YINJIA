/* 焦点诊断:派发「新增数据」后 库位编码 编辑器是否真的聚焦(v-cell-focus 生效性);
   并用派发点击激活 库位地址 cell-lazy,再 JS 聚焦 + CDP 真实键盘验证输入落值 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require(path.join(__dirname, '..', 'node_modules', 'ws'))

const PORT = 9382
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const login = await loginRes.json()

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-focus-'))
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
      if (r.result && r.result.exceptionDetails) return 'EVAL_ERR:' + JSON.stringify(r.result.exceptionDetails).slice(0, 300)
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 60; i++) { await sleep(300); if (await evalOnce('document.readyState') === 'complete') { await sleep(700); return } }
    }
    const pressKey = async (ch) => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch, code: 'Key' + ch.toUpperCase(), unmodifiedText: ch })
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, code: 'Key' + ch.toUpperCase() })
    }

    await send('Page.enable')
    await navigate(`${BASE}/#/login`)
    await evalOnce(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')
    await navigate(`${BASE}/#/panelx/list/WHLOC`)
    for (let i = 0; i < 80; i++) { await sleep(500); if (await evalOnce(`document.querySelectorAll('.el-table__row').length`) > 0) break }
    await sleep(1500)

    await evalOnce(`(function(){
      window.__log = []
      window.__mainTable = function(){ return [].slice.call(document.querySelectorAll('.el-table')).filter(function(t){return !t.closest('.el-dialog')})[0] };
      window.__dataRows = function(){ var t=window.__mainTable(); if(!t) return []; return [].slice.call(t.querySelectorAll('.el-table__row')).filter(function(r){return r.querySelector('.cell-lazy, .inline-ref-editor, td .el-input, td .el-select, td .el-switch')}) };
      window.__lastRowCell = function(label){ var t=window.__mainTable(); if(!t) return null; var ths=[].slice.call(t.querySelectorAll('.el-table__header th')); var idx=-1; ths.forEach(function(th,i){ if((th.textContent||'').indexOf(label)>=0 && idx<0) idx=i }); var rs=window.__dataRows(); var tr=rs[rs.length-1]; if(!tr) return null; return tr.querySelectorAll('td')[idx] };
      window.__watchCell = function(label){ var td=window.__lastRowCell(label); if(!td) return 'no-td'; var inp=td.querySelector('input'); if(!inp) return 'no-input';
        inp.addEventListener('focus', function(){ window.__log.push(label+' focus@'+performance.now().toFixed(0)) });
        inp.addEventListener('blur', function(){ window.__log.push(label+' blur@'+performance.now().toFixed(0) + ' -> ' + (document.activeElement && document.activeElement.tagName)) });
        return 'watching' };
      return 'ok'
    })()`)

    // ① 派发点击「新增数据」
    await evalOnce(`(function(){var els=[].slice.call(document.querySelectorAll('button'));var el=els.find(function(x){return (x.textContent||'').trim()==='新增数据'});if(el){el.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'clicked'}return 'no-btn'})()`)
    await sleep(900)
    console.log('① 新增数据后 activeElement:', await evalOnce(`(function(){var a=document.activeElement;return a ? a.tagName+'.'+String(a.className).slice(0,40)+' val='+(a.value!==undefined?String(a.value):'-') : 'none'})()`))
    console.log('   库位编码 watcher:', await evalOnce('window.__watchCell("库位编码")'))
    console.log('   事件日志(挂 watcher 前 900ms):', await evalOnce('JSON.stringify(window.__log)'))
    // watcher 是刚挂的,重放一次激活:先点掉(activeCell 已在新行库位编码上),再切换到 库位地址 又切回
    // ② 派发点击 库位地址 cell-lazy span(新行)
    console.log('② 库位地址 cell-lazy 派发点击:', await evalOnce(`(function(){var td=window.__lastRowCell('库位地址');if(!td)return 'no-td';var sp=td.querySelector('.cell-lazy');if(!sp) return td.querySelector('input')?'已常驻编辑器':'无span';sp.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'clicked'})()`))
    await sleep(700)
    console.log('   点击后 activeElement:', await evalOnce(`(function(){var a=document.activeElement;return a ? a.tagName+'.'+String(a.className).slice(0,40) : 'none'})()`))
    console.log('   库位地址 编辑器状态:', await evalOnce(`(function(){var td=window.__lastRowCell('库位地址');if(!td)return 'no-td';var inp=td.querySelector('input');return JSON.stringify({editor:!!inp,lazy:!!td.querySelector('.cell-lazy'),focusIn:!!(inp&&inp===document.activeElement)})})()`))
    console.log('   事件日志:', await evalOnce('JSON.stringify(window.__log)'))
    // ③ CDP 真实键盘:焦点若已在 库位地址 input,直接打字
    for (const ch of ['B', '2']) {
      await pressKey(ch); await sleep(350)
      console.log(`   按'${ch}' →`, await evalOnce(`(function(){var td=window.__lastRowCell('库位地址');if(!td)return 'no-td';var inp=td.querySelector('input');return JSON.stringify({val:inp?inp.value:null,focusIn:!!(inp&&inp===document.activeElement)})})()`))
    }
    // ④ 再验证 库位编码(自动激活的那个):派发点击它的 cell 区域切回
    console.log('④ 库位编码 派发点击切回:', await evalOnce(`(function(){var td=window.__lastRowCell('库位编码');if(!td)return 'no-td';var inp=td.querySelector('input');if(inp){inp.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'clicked-input'}return 'no-input'})()`))
    await sleep(600)
    for (const ch of ['A', '9']) {
      await pressKey(ch); await sleep(350)
      console.log(`   按'${ch}' →`, await evalOnce(`(function(){var td=window.__lastRowCell('库位编码');if(!td)return 'no-td';var inp=td.querySelector('input');return JSON.stringify({val:inp?inp.value:null,focusIn:!!(inp&&inp===document.activeElement)})})()`))
    }
    console.log('事件日志终态:', await evalOnce('JSON.stringify(window.__log)'))
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message, '| cause:', e.cause ? (e.cause.code || e.cause.message) : 'n/a'); process.exit(1) })
