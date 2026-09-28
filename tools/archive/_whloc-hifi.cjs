/* 诊断⑫:高频采样真实点击→激活→打字全链路,抓编辑器丢失的瞬间
   场景A: 直接点 编码 格 → 立即连打(不等)
   场景B: 先在 编码 打过字(置脏)→ 点 地址 格 → 立即连打(模拟用户连续填两列)
   场景C: 点 编码 格后先等 800ms 再打(区分「激活瞬间被重渲染拍掉」vs「打字中被拍掉」) */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require(path.join(__dirname, '..', 'node_modules', 'ws'))

const PORT = 9369
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const HELPERS = `
window.__mainTable = function(){ return [].slice.call(document.querySelectorAll('.el-table')).filter(function(t){return !t.closest('.el-dialog')})[0] };
window.__rows = function(){ var t=window.__mainTable(); if(!t) return []; return [].slice.call(t.querySelectorAll('.el-table__row')) };
window.__dataRows = function(){ return window.__rows().filter(function(r){return r.querySelector('.cell-lazy,.inline-ref-editor,td .el-input,td .el-select,td .el-switch')}) };
window.__cellOf = function(label){ var t=window.__mainTable(); if(!t) return null; var ths=[].slice.call(t.querySelectorAll('.el-table__header th')); var idx=-1; ths.forEach(function(th,i){ if((th.textContent||'').indexOf(label)>=0 && idx<0) idx=i }); if(idx<0) return null; var rs=window.__dataRows(); var tr=rs.length?rs[rs.length-1]:null; if(!tr) return null; return tr.querySelectorAll('td')[idx]||null };
window.__rect = function(el){ if(!el) return null; var r=el.getBoundingClientRect(); return JSON.stringify({x:r.left+r.width/2,y:r.top+r.height/2}) };
window.__snap = function(label){ var td=window.__cellOf(label); if(!td) return 'NO_TD'; var inp=td.querySelector('input'); var ae=document.activeElement; return JSON.stringify({ed:!!inp, v: inp? String(inp.value).slice(0,12):'(span)'+(td.textContent||'').trim().slice(0,8), foc: !!(ae&&ae.tagName==='INPUT'&&td.contains(ae)), aeCls: String(ae&&ae.className||'').slice(0,18) }) };
// 高频采样器:每 interval 毫秒记一次快照,共 dur 毫秒
window.__samples = [];
window.__startSample = function(label,interval,dur){ window.__samples=[]; var n=0; var t0=Date.now(); var iv=setInterval(function(){ window.__samples.push({t:Date.now()-t0, s:window.__snap(label)}); if(Date.now()-t0>dur){clearInterval(iv)} }, interval) };
window.__dumpSamples = function(){ var s=window.__samples.slice(); window.__samples=[]; return JSON.stringify(s) };
`

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const login = await loginRes.json()

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-hifi-'))
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
      await sleep(50)
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
    }
    const clickCell = async (label) => { const r = await evalOnce(`window.__rect(window.__cellOf('${label}'))`); if (r && String(r).startsWith('{')) await realClick(JSON.parse(r).x, JSON.parse(r).y) }
    const pressKey = async (ch) => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch, code: 'Key' + ch.toUpperCase(), unmodifiedText: ch })
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, code: 'Key' + ch.toUpperCase() })
    }

    await send('Page.enable'); await send('Runtime.enable')
    await navigate(`${BASE}/#/login`)
    await evalOnce(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_init_done','1'); 'ok'`)
    await navigate('about:blank')
    await navigate(`${BASE}/#/panelx/list/WHLOC`)
    for (let i = 0; i < 40; i++) { await sleep(300); if (await evalOnce(`document.querySelectorAll('.el-table__row').length`) > 0) break }
    await sleep(1200)
    await evalOnce(HELPERS)

    // 先加一行新数据作为靶行
    const addData = await evalOnce(`(function(){var els=[].slice.call(document.querySelectorAll('button,span'));var el=els.find(function(x){return (x.textContent||'').trim()==='新增数据'});if(!el)return 'NO_BTN';var r=el.getBoundingClientRect();return JSON.stringify({x:r.left+r.width/2,y:r.top+r.height/2})})()`)
    if (addData && String(addData).startsWith('{')) { const r = JSON.parse(addData); await realClick(r.x, r.y); await sleep(600) }
    console.log('靶行就绪:', await evalOnce('(function(){return window.__dataRows().length})()'), '行')

    // ── 场景C:点 编码 格(首击激活)→ 高频采样 1.2s(观察激活后是否被重渲染拍掉)──
    console.log('\n── 场景C:首击激活后编辑器存活曲线 ──')
    await clickCell('库位编码')
    await evalOnce('window.__startSample("库位编码", 60, 1200)')
    await sleep(1300)
    console.log(await evalOnce('window.__dumpSamples()'))

    // 二击进输入框 → 立即打 Q → 高频采样
    console.log('\n── 场景A:二击进输入框→立即连打 QT5 ──')
    await clickCell('库位编码')
    await evalOnce('window.__startSample("库位编码", 50, 1200)')
    await pressKey('Q'); await sleep(180); await pressKey('T'); await sleep(180); await pressKey('5'); await sleep(180)
    await sleep(500)
    console.log(await evalOnce('window.__dumpSamples()'))

    // ── 场景B:编码已置脏 → 点 地址 格 → 立即连打 ──
    console.log('\n── 场景B:切换到 地址 立即连打 ZK2 ──')
    await clickCell('库位地址')
    await evalOnce('window.__startSample("库位地址", 50, 1500)')
    await pressKey('Z'); await sleep(150); await pressKey('K'); await sleep(150); await pressKey('2'); await sleep(150)
    await sleep(800)
    console.log(await evalOnce('window.__dumpSamples()'))
    console.log('\n最终 编码:', await evalOnce('window.__snap("库位编码")'), ' 地址:', await evalOnce('window.__snap("库位地址")'))
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
