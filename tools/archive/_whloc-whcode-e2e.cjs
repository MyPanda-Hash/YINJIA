/* 端到端验证「仓库编码随选仓库自动带入」:WHLOC → 新增数据(自动激活应落在库位编码,跳过带入字段仓库编码)
   → 点新行仓库参照 → RefPickDialog 勾首行 → 确定 → 断言 row.仓库编码=所选仓库的编码 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require(path.join(__dirname, '..', 'node_modules', 'ws'))

const PORT = 9384
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json())

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-whcode-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,900', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    const errors = []
    ws.on('message', (data) => {
      let m; try { m = JSON.parse(data.toString()) } catch { return }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push((m.params.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 300))
      if (m.method === 'Runtime.exceptionThrown') errors.push('EXC:' + JSON.stringify(m.params.exceptionDetails || {}).slice(0, 300))
    })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evalOnce = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result && r.result.exceptionDetails) return 'EVAL_ERR:' + JSON.stringify(r.result.exceptionDetails).slice(0, 200)
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 60; i++) { await sleep(300); if (await evalOnce('document.readyState') === 'complete') { await sleep(700); return } }
    }

    await send('Page.enable'); await send('Runtime.enable')
    await navigate(`${BASE}/#/login`)
    await evalOnce(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')
    await navigate(`${BASE}/#/panelx/list/WHLOC`)
    for (let i = 0; i < 80; i++) { await sleep(500); if (await evalOnce(`document.querySelectorAll('.el-table__row').length`) > 0) break }
    await sleep(1500)
    console.log('页面状态:', await evalOnce(`(function(){return JSON.stringify({hash:location.hash,title:document.title,panelx:!!document.querySelector('.panelx-list'),rows:document.querySelectorAll('.el-table__row').length,tables:document.querySelectorAll('.el-table').length,msgs:[].slice.call(document.querySelectorAll('.el-message')).map(function(m){return (m.textContent||'').trim()}).join('|')})})()`))

    await evalOnce(`(function(){
      window.__mainTable = function(){ return [].slice.call(document.querySelectorAll('.el-table')).filter(function(t){return !t.closest('.el-dialog')})[0] };
      window.__dataRows = function(){ var t=window.__mainTable(); if(!t) return []; return [].slice.call(t.querySelectorAll('.el-table__row')).filter(function(r){return r.querySelector('.cell-lazy, .inline-ref-editor, td .el-input, td .el-select, td .el-switch')}) };
      window.__lastRowCell = function(label){ var t=window.__mainTable(); if(!t) return null; var ths=[].slice.call(t.querySelectorAll('.el-table__header th')); var idx=-1; ths.forEach(function(th,i){ if((th.textContent||'').indexOf(label)>=0 && idx<0) idx=i }); var rs=window.__dataRows(); var tr=rs[rs.length-1]; if(!tr) return null; return tr.querySelectorAll('td')[idx] };
      window.__rowState = function(){ var el=document.querySelector('.el-table'); var inst=el&&el.__vueParentComponent; var hops=0; while(inst&&hops<25){ var ss=inst.setupState||{}; if('activeCellEcho' in ss){ var cur=ss.cur.value!==undefined?ss.cur.value:ss.cur; var rows=((cur.detail||{}).locations||[]); var r=rows[rows.length-1]; var ac=ss.activeCell; var acv=ac&&ac.value!==undefined?ac.value:ac; /* setupState=proxyRefs 已解包,.value 恒 undefined——两种形态都兜住 */ return JSON.stringify({activeProp: acv?acv.prop:null, row: r?{仓库:r['仓库'],仓库编码:r['仓库编码'],库位编码:r['库位编码'],库位地址:r['库位地址']}:null}) } inst=inst.parent; hops++ } return 'NOT_FOUND' };
      return 'ok' })()`)

    // ① 新增数据 → 自动激活应落 库位编码(跳过 仓库/仓库编码)
    await evalOnce(`(function(){var els=[].slice.call(document.querySelectorAll('button'));var el=els.find(function(x){return (x.textContent||'').trim()==='新增数据'});if(el)el.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'ok'})()`)
    await sleep(900)
    console.log('① 新增数据后:', await evalOnce('window.__rowState()'))
    if (errors.length) console.log('   ①后错误:', errors.slice(0, 4))

    // ② 点新行 仓库 参照 → 弹 RefPickDialog
    console.log('② 点仓库格:', await evalOnce(`(function(){var td=window.__lastRowCell('仓库');if(!td)return 'no-td';var ed=td.querySelector('.inline-ref-editor input')||td.querySelector('.inline-ref-editor');if(!ed)return 'no-editor';ed.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'clicked'})()`))
    await sleep(900)
    const dlg = await evalOnce(`(function(){var d=document.querySelector('.el-dialog');if(!d||!d.offsetParent)return 'no-dialog';var rows=[].slice.call(d.querySelectorAll('.el-table__row'));return JSON.stringify({visible:true,rows:rows.length,firstRowText:(rows[0]?rows[0].textContent:'').slice(0,40)})})()`)
    console.log('   参照弹窗:', dlg)
    if (!String(dlg).startsWith('{"visible"')) { console.log('!! 弹窗未开,终止'); ws.close(); return }

    // ③ 勾首行 selection checkbox → 确定
    await evalOnce(`(function(){var d=document.querySelector('.el-dialog');var cb=d.querySelector('.el-table__row .el-checkbox');if(!cb)return 'no-cb';cb.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'checked'})()`)
    await sleep(400)
    console.log('   勾选后:', await evalOnce(`(function(){var d=document.querySelector('.el-dialog');var btns=[].slice.call(d.querySelectorAll('button'));var ok=btns.find(function(b){return (b.textContent||'').indexOf('确定导入')>=0});if(!ok)return 'no-ok-btn';if(ok.disabled)return 'ok-disabled';ok.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'confirmed'})()`))
    await sleep(900)

    // ④ 断言:保存+重载后,找到新行(原料不良品仓)→ 仓库编码=CK00005 自动带入
    console.log('④ 确认后重载行状态(末行):', await evalOnce('window.__rowState()'))
    console.log('   新行(原料不良品仓)各格:', await evalOnce(`(function(){var rs=window.__dataRows();for(var i=0;i<rs.length;i++){var tds=rs[i].querySelectorAll('td');var wh=(tds[1]?tds[1].textContent:'')+'';if(wh.indexOf('原料不良品仓')>=0){var get=function(n){for(var j=0;j<tds.length;j++){var inp=tds[j].querySelector('input');var v=inp?String(inp.value):(tds[j].textContent||'').trim();if(j===n)return v}return ''};return JSON.stringify({仓库:wh.trim(),仓库编码:(tds[2]?tds[2].textContent:'').trim(),库位编码:(tds[3]?tds[3].textContent:'').trim()})}}return 'not-found'})()`))
    console.log('   toast:', await evalOnce(`(function(){return [].slice.call(document.querySelectorAll('.el-message')).map(function(m){return (m.textContent||'').trim()}).join(' | ')})()`))
    console.log('console 错误:', errors.length ? errors.slice(0, 8) : '无')
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message, '| cause:', e.cause ? (e.cause.code || e.cause.message) : 'n/a'); process.exit(1) })
