/* 键盘落值诊断:focus 在 库位地址 input 上,逐个试验 keyDown+text / insertText 是否落值;记录 keydown 到达情况 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require(path.join(__dirname, '..', 'node_modules', 'ws'))

const PORT = 9383
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const login = await loginRes.json()

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-key-'))
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

    await send('Page.enable')
    await navigate(`${BASE}/#/login`)
    await evalOnce(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')
    await navigate(`${BASE}/#/panelx/list/WHLOC`)
    for (let i = 0; i < 80; i++) { await sleep(500); if (await evalOnce(`document.querySelectorAll('.el-table__row').length`) > 0) break }
    await sleep(1500)

    // 新增数据 + 激活 库位地址
    await evalOnce(`(function(){
      window.__keys = []
      window.__mainTable = function(){ return [].slice.call(document.querySelectorAll('.el-table')).filter(function(t){return !t.closest('.el-dialog')})[0] };
      window.__dataRows = function(){ var t=window.__mainTable(); if(!t) return []; return [].slice.call(t.querySelectorAll('.el-table__row')).filter(function(r){return r.querySelector('.cell-lazy, .inline-ref-editor, td .el-input, td .el-select, td .el-switch')}) };
      window.__lastRowCell = function(label){ var t=window.__mainTable(); if(!t) return null; var ths=[].slice.call(t.querySelectorAll('.el-table__header th')); var idx=-1; ths.forEach(function(th,i){ if((th.textContent||'').indexOf(label)>=0 && idx<0) idx=i }); var rs=window.__dataRows(); var tr=rs[rs.length-1]; if(!tr) return null; return tr.querySelectorAll('td')[idx] };
      var els=[].slice.call(document.querySelectorAll('button'));var el=els.find(function(x){return (x.textContent||'').trim()==='新增数据'});if(el)el.dispatchEvent(new MouseEvent('click',{bubbles:true}));
      return 'added' })()`)
    await sleep(800)
    console.log('激活 库位地址:', await evalOnce(`(function(){var td=window.__lastRowCell('库位地址');if(!td)return 'no-td';var sp=td.querySelector('.cell-lazy');if(!sp)return td.querySelector('input')?'already-editor':'no-span';sp.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'clicked'})()`))
    await sleep(600)
    console.log('编辑器/焦点:', await evalOnce(`(function(){var td=window.__lastRowCell('库位地址');var inp=td&&td.querySelector('input');if(!inp)return 'no-input';inp.addEventListener('keydown',function(e){window.__keys.push('kd:'+e.key+':defaulted='+e.defaultPrevented)});inp.addEventListener('input',function(){window.__keys.push('input:'+inp.value)});return JSON.stringify({focusIn:inp===document.activeElement,readOnly:inp.readOnly,disabled:inp.disabled})})()`))

    // 试验A: keyDown 带 text
    await send('Input.dispatchKeyEvent', { type: 'keyDown', text: 'X', key: 'X', code: 'KeyX', unmodifiedText: 'X', windowsVirtualKeyCode: 88 })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'X', code: 'KeyX', windowsVirtualKeyCode: 88 })
    await sleep(400)
    console.log('A keyDown+text → val:', await evalOnce(`(function(){var td=window.__lastRowCell('库位地址');var inp=td&&td.querySelector('input');return inp?JSON.stringify({val:inp.value}):'no-input'})()`), ' events:', await evalOnce('JSON.stringify(window.__keys)'))

    // 试验B: insertText
    await evalOnce('window.__keys.length=0')
    await send('Input.insertText', { text: 'Y9' })
    await sleep(400)
    console.log('B insertText → val:', await evalOnce(`(function(){var td=window.__lastRowCell('库位地址');var inp=td&&td.querySelector('input');return inp?JSON.stringify({val:inp.value}):'no-input'})()`), ' events:', await evalOnce('JSON.stringify(window.__keys)'))

    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message, '| cause:', e.cause ? (e.cause.code || e.cause.message) : 'n/a'); process.exit(1) })
