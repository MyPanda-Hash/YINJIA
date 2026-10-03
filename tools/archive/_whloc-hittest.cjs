/* 诊断⑩:命中测试——真实点击坐标上是哪个元素?谁在盖住表格? */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require(path.join(__dirname, '..', 'node_modules', 'ws'))

const PORT = 9365
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const login = await loginRes.json()

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-hit-'))
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
    await send('Page.enable')
    await navigate(`${BASE}/#/login`)
    await evalOnce(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')
    await navigate(`${BASE}/#/panelx/list/WHLOC`)
    for (let i = 0; i < 40; i++) { await sleep(300); if (await evalOnce(`document.querySelectorAll('.el-table__row').length`) > 0) break }
    await sleep(1200)

    // ① 表格第一数据行 库位编码 单元格中心点上,自上而下的命中链
    const chain = await evalOnce(`(function(){
      var t=[].slice.call(document.querySelectorAll('.el-table')).filter(function(x){return !x.closest('.el-dialog')})[0];
      if(!t) return 'NO_TABLE';
      var ths=[].slice.call(t.querySelectorAll('.el-table__header th'));
      var idx=-1; ths.forEach(function(th,i){ if((th.textContent||'').indexOf('库位编码')>=0 && idx<0) idx=i });
      var rows=[].slice.call(t.querySelectorAll('.el-table__row')).filter(function(r){return r.querySelector('.cell-lazy,.inline-ref-editor,td .el-input,td .el-select')});
      var tr=rows[0]; if(!tr) return 'NO_DATA_ROW';
      var td=tr.querySelectorAll('td')[idx]; var r=td.getBoundingClientRect();
      var x=Math.round(r.left+r.width/2), y=Math.round(r.top+r.height/2);
      var hit=document.elementFromPoint(x,y);
      var chain=[]; var el=hit; var n=0;
      while(el && n<6){ chain.push(el.tagName+'.'+String(el.className).split(' ').slice(0,3).join('.')); el=el.parentElement; n++ }
      return JSON.stringify({point:{x:x,y:y}, tdW:Math.round(r.width), hitTag: hit.tagName, hitCls: String(hit.className).slice(0,80), hitChain: chain, tdIsHit: td.contains(hit)})
    })()`)
    console.log('① 库位编码 单元格命中:', chain)

    // ② 工具栏「新增」span 中心点上是谁
    const chain2 = await evalOnce(`(function(){
      var els=[].slice.call(document.querySelectorAll('button,span'));
      var el=els.find(function(x){return (x.textContent||'').trim()==='新增'});
      if(!el) return 'NO_BTN';
      var r=el.getBoundingClientRect(); var x=Math.round(r.left+r.width/2), y=Math.round(r.top+r.height/2);
      var hit=document.elementFromPoint(x,y);
      return JSON.stringify({point:{x:x,y:y}, hitTag:hit.tagName, hitCls:String(hit.className).slice(0,80), btnContainsHit: el.contains(hit), hitIsBtn: hit===el||el.contains(hit)})
    })()`)
    console.log('② 工具栏新增命中:', chain2)

    // ③ 全页大尺寸绝对定位/固定层清点(疑似盖板)
    const overlays = await evalOnce(`(function(){
      var bad=[];
      [].slice.call(document.querySelectorAll('body *')).forEach(function(el){
        var cs=getComputedStyle(el); if(cs.position!=='fixed'&&cs.position!=='absolute') return;
        var w=el.offsetWidth,h=el.offsetHeight; if(w<400||h<200) return;
        if(cs.pointerEvents==='none') return;
        bad.push({tag:el.tagName, cls:String(el.className).slice(0,60), w:w, h:h, z:cs.zIndex, pe:cs.pointerEvents, op:cs.opacity});
      });
      return JSON.stringify(bad.slice(0,12));
    })()`)
    console.log('③ 可疑覆盖层:', overlays)
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
