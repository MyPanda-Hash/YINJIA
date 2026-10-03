/* 诊断⑧(E2E 终版):WHLOC 主表限定 —— 新增数据 → 参照弹窗勾选仓库导入 → 真实键盘连打 编码/地址 → 保存 → 查库验证 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require(path.join(__dirname, '..', 'node_modules', 'ws'))

const PORT = 9361
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 注入浏览器的帮助函数(主表定位:非 .el-dialog 内的表格)
const HELPERS = `
window.__mainTable = function(){ return [].slice.call(document.querySelectorAll('.el-table')).filter(function(t){return !t.closest('.el-dialog')})[0] };
window.__mainDataRows = function(){ var t=window.__mainTable(); if(!t) return []; return [].slice.call(t.querySelectorAll('.el-table__row')).filter(function(r){return r.querySelector('.cell-lazy, .inline-ref-editor, td .el-input, td .el-select, td .el-switch')}) };
window.__mainRow = function(){ var rs=window.__mainDataRows(); return rs[rs.length-1] };
window.__cellOf = function(label){ var t=window.__mainTable(); if(!t) return null; var ths=[].slice.call(t.querySelectorAll('.el-table__header th')); var idx=-1; ths.forEach(function(th,i){ if((th.textContent||'').indexOf(label)>=0 && idx<0) idx=i }); if(idx<0) return null; var tr=window.__mainRow(); var tds=tr.querySelectorAll('td'); return tds[idx] || null };
window.__cellState = function(label){ var td=window.__cellOf(label); if(!td) return 'NO_TD:'+label; var inp=td.querySelector('input'); var ae=document.activeElement; return JSON.stringify({editor:!!inp, val: inp? String(inp.value).slice(0,16) : (td.textContent||'').trim().slice(0,16), focusIn: !!td.contains(ae)}) };
`

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const login = await loginRes.json()

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-e2e3-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
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
      for (let i = 0; i < 50; i++) { await sleep(200); if (await evalOnce('document.readyState') === 'complete') { await sleep(600); return } }
    }
    const pressKey = async (ch) => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch, code: 'Key' + ch.toUpperCase(), unmodifiedText: ch })
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, code: 'Key' + ch.toUpperCase() })
    }
    const clickBtn = (text) => evalOnce(`(function(){var bs=[].slice.call(document.querySelectorAll('button'));var b=bs.find(function(x){return (x.textContent||'').indexOf('${text}')>=0});if(!b)return 'NO_BTN:${text}';b.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'CLICKED:${text}'})()`)

    await send('Page.enable'); await send('Runtime.enable')
    await navigate(`${BASE}/#/login`)
    await evalOnce(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')
    await navigate(`${BASE}/#/panelx/list/WHLOC`)
    for (let i = 0; i < 40; i++) { await sleep(300); if (await evalOnce(`document.querySelectorAll('.el-table__row').length`) > 0) break }
    await sleep(1000)
    await evalOnce(HELPERS)

    console.log('① 新增数据:', await clickBtn('新增数据'))
    await sleep(600)
    console.log('   新行 仓库:', await evalOnce('window.__cellState("仓库")'))

    // ② 点新行 仓库 编辑器(readonly input @click → 参照弹窗)
    console.log('② 点仓库:', await evalOnce(`(function(){var td=window.__cellOf('仓库');if(!td)return 'NO_TD';var inp=td.querySelector('input');if(!inp)return 'NO_INPUT';inp.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'CLICKED'})()`))
    await sleep(1000)
    console.log('③ 弹窗:', await evalOnce(`(function(){var d=document.querySelector('.el-dialog');if(!d||d.style.display==='none')return 'NO_DIALOG';var rows=[].slice.call(d.querySelectorAll('.el-table__row'));return 'OPEN rows='+rows.length})()`))
    // 勾选第一行(selection 列的 checkbox)
    console.log('   勾选:', await evalOnce(`(function(){var d=document.querySelector('.el-dialog');var row=d.querySelectorAll('.el-table__row')[0];if(!row)return 'NO_ROW';var cb=row.querySelector('.el-checkbox');if(!cb)return 'NO_CB';cb.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'CHECKED:'+(row.textContent||'').replace(/\\s+/g,'').slice(0,22)})()`))
    await sleep(400)
    console.log('   确定:', await evalOnce(`(function(){var d=document.querySelector('.el-dialog');var bs=[].slice.call(d.querySelectorAll('button'));var b=bs.find(function(x){return (x.textContent||'').indexOf('确定')>=0});if(!b)return 'NO_CONFIRM';if(b.disabled)return 'DISABLED';b.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'CONFIRMED'})()`))
    await sleep(800)
    console.log('   导入后 仓库:', await evalOnce('window.__cellState("仓库")'))

    // ④ 库位编码:激活 + 真实键盘连打
    console.log('④ 激活库位编码:', await evalOnce(`(function(){var td=window.__cellOf('库位编码');if(!td)return 'NO_TD';var lazy=td.querySelector('.cell-lazy');var ed=td.querySelector('input');if(ed){ed.focus();return 'ALREADY'}if(!lazy)return 'NO_LAZY';lazy.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'ACT'})()`))
    await sleep(400)
    console.log('   聚焦:', await evalOnce(`(function(){var td=window.__cellOf('库位编码');var inp=td&&td.querySelector('input');if(!inp)return 'NO_INPUT';inp.focus();return 'FOC'})()`))
    for (const ch of ['K', 'W', '0', '0', '2']) {
      await pressKey(ch)
      await sleep(350)
      console.log(`   按'${ch}' →`, await evalOnce('window.__cellState("库位编码")'))
    }

    // ⑤ 库位地址
    console.log('⑤ 激活库位地址:', await evalOnce(`(function(){var td=window.__cellOf('库位地址');if(!td)return 'NO_TD';var lazy=td.querySelector('.cell-lazy');var ed=td.querySelector('input');if(ed){ed.focus();return 'ALREADY'}if(!lazy)return 'NO_LAZY';lazy.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'ACT'})()`))
    await sleep(400)
    await evalOnce(`(function(){var td=window.__cellOf('库位地址');var inp=td&&td.querySelector('input');if(inp){inp.focus();return 'F'}return 'N'})()`)
    for (const ch of ['B', '2']) {
      await pressKey(ch)
      await sleep(350)
      console.log(`   按'${ch}' →`, await evalOnce('window.__cellState("库位地址")'))
    }

    // ⑥ 保存 → 后端落库
    console.log('⑥ 保存:', await clickBtn('保存'))
    await sleep(1500)
    const db = await evalOnce(`(async function(){var t=localStorage.getItem('mes_token');var r=await fetch('/api/px/queryFormDataList',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify({panelCode:'WHLOC',pageNo:1,pageSize:50})});var j=await r.json();var rows=(j.data&&j.data.list&&j.data.list[0]&&j.data.list[0].detail&&j.data.list[0].detail.locations)||[];return JSON.stringify(rows)})()`)
    console.log('   落库行:', db)
    console.log('\nconsole 错误:', errors.length ? errors.slice(0, 5) : '无')
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
