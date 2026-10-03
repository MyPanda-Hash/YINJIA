/* 诊断⑦(E2E):WHLOC 完整用户流 —— 新增数据 → 点仓库参照弹窗选仓 → 真实键盘事件打 库位编码/库位地址
   每一步输出焦点/编辑器/值状态;结束截图。 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require(path.join(__dirname, '..', 'node_modules', 'ws'))

const PORT = 9359
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const login = await loginRes.json()

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-e2e-whloc-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  const shot = path.join(process.env.TEMP || os.tmpdir(), 'whloc-e2e.png')
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
    // 真实按键:keyDown(text) → keyUp,走浏览器原生输入管线(触发 input 事件)
    const pressKey = async (ch) => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch, code: 'Key' + ch.toUpperCase(), unmodifiedText: ch })
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, code: 'Key' + ch.toUpperCase() })
    }
    const cellState = (label) => evalOnce(`(function(){
      var ths=[].slice.call(document.querySelectorAll('.el-table__header th'));
      var idx=-1; ths.forEach(function(th,i){ if((th.textContent||'').indexOf('${label}')>=0 && idx<0) idx=i });
      var trs=[].slice.call(document.querySelectorAll('.el-table__row'));
      var tr=trs[trs.length-1]; // 新增行在末尾
      if(!tr||idx<0) return 'NO_TARGET';
      var td=tr.querySelectorAll('td')[idx];
      var inp=td&&td.querySelector('input');
      var ae=document.activeElement;
      return JSON.stringify({ label:'${label}', editor: !!inp, val: inp? inp.value : (td?(td.textContent||'').trim().slice(0,14):''), focusIn: !!(td&&td.contains(ae)) })
    })()`)

    await send('Page.enable'); await send('Runtime.enable')
    await navigate(`${BASE}/#/login`)
    await evalOnce(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')
    await navigate(`${BASE}/#/panelx/list/WHLOC`)
    for (let i = 0; i < 40; i++) { await sleep(300); if (await evalOnce(`document.querySelectorAll('.el-table__row').length`) > 0) break }
    await sleep(1200)

    // ① 新增数据
    console.log('① 新增数据:', await evalOnce(`(function(){var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return (x.textContent||'').indexOf('新增数据')>=0});if(!b)return 'NO_BTN';b.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'CLICKED'})()`))
    await sleep(600)
    console.log('   新行 仓库 初始:', await cellState('仓库'))

    // ② 点新行 仓库 编辑器(常驻 readonly input,原实现=点击开参照弹窗)
    console.log('② 点仓库单元格:', await evalOnce(`(function(){
      var trs=[].slice.call(document.querySelectorAll('.el-table__row')).filter(function(r){return r.querySelector('.cell-lazy, .inline-ref-editor, td .el-input, td .el-select, td .el-switch')}); var tr=trs[trs.length-1];
      var tds=tr.querySelectorAll('td'); var td=tds[1]; // col1=仓库
      var inp=td.querySelector('input');
      if(!inp) return 'NO_INPUT:'+(td.textContent||'').slice(0,10);
      inp.dispatchEvent(new MouseEvent('click',{bubbles:true}));
      return 'CLICKED'
    })()`))
    await sleep(900)
    // ③ 弹窗应打开:选第一行仓 → 确定导入
    const dlg = await evalOnce(`(function(){var d=document.querySelector('.el-dialog');if(!d)return 'NO_DIALOG';var rows=[].slice.call(d.querySelectorAll('.el-table__row'));return 'DIALOG rows='+rows.length+' first='+(rows[0]? (rows[0].textContent||'').replace(/\\s+/g,'').slice(0,20):'')})()`)
    console.log('③ 参照弹窗:', dlg)
    if (!String(dlg).startsWith('NO_DIALOG')) {
      console.log('   选行:', await evalOnce(`(function(){var d=document.querySelector('.el-dialog');var row=d.querySelectorAll('.el-table__row')[0];if(!row)return 'NO_ROW';row.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'ROW_CLICKED'})()`))
      await sleep(400)
      console.log('   确定导入:', await evalOnce(`(function(){var d=document.querySelector('.el-dialog');var bs=[].slice.call(d.querySelectorAll('button'));var b=bs.find(function(x){return (x.textContent||'').indexOf('确定')>=0});if(!b)return 'NO_CONFIRM';if(b.disabled)return 'DISABLED';b.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'CONFIRMED'})()`))
      await sleep(800)
    }
    console.log('   仓库选中后:', await cellState('仓库'))

    // ④ 库位编码:点 cell-lazy 激活 → 真实键盘连打 5 个字符
    console.log('④ 库位编码 激活:', await evalOnce(`(function(){
      var ths=[].slice.call(document.querySelectorAll('.el-table__header th'));
      var idx=-1; ths.forEach(function(th,i){ if((th.textContent||'').indexOf('库位编码')>=0 && idx<0) idx=i });
      var trs=[].slice.call(document.querySelectorAll('.el-table__row')).filter(function(r){return r.querySelector('.cell-lazy, .inline-ref-editor, td .el-input, td .el-select, td .el-switch')}); var tr=trs[trs.length-1];
      var td=tr.querySelectorAll('td')[idx];
      var lazy=td.querySelector('.cell-lazy'); var ed=td.querySelector('input');
      if(ed){ ed.focus(); return 'ALREADY_EDITOR' }
      if(!lazy) return 'NO_LAZY';
      lazy.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'ACTIVATED'
    })()`))
    await sleep(400)
    console.log('   聚焦:', await evalOnce(`(function(){var trs=[].slice.call(document.querySelectorAll('.el-table__row')).filter(function(r){return r.querySelector('.cell-lazy, .inline-ref-editor, td .el-input, td .el-select, td .el-switch')});var tr=trs[trs.length-1];var ths=[].slice.call(document.querySelectorAll('.el-table__header th'));var idx=-1;ths.forEach(function(th,i){if((th.textContent||'').indexOf('库位编码')>=0&&idx<0)idx=i});var td=tr.querySelectorAll('td')[idx];var inp=td.querySelector('input');if(!inp)return 'NO_INPUT';inp.focus();return 'FOCUSED'})()`))
    for (const ch of ['K', 'W', '0', '0', '1']) {
      await pressKey(ch)
      await sleep(300)
      console.log(`   按'${ch}' →`, await cellState('库位编码'))
    }

    // ⑤ 库位地址同样
    console.log('⑤ 库位地址 激活+聚焦:', await evalOnce(`(function(){
      var ths=[].slice.call(document.querySelectorAll('.el-table__header th'));
      var idx=-1; ths.forEach(function(th,i){ if((th.textContent||'').indexOf('库位地址')>=0 && idx<0) idx=i });
      var trs=[].slice.call(document.querySelectorAll('.el-table__row')).filter(function(r){return r.querySelector('.cell-lazy, .inline-ref-editor, td .el-input, td .el-select, td .el-switch')}); var tr=trs[trs.length-1];
      var td=tr.querySelectorAll('td')[idx];
      var lazy=td.querySelector('.cell-lazy'); var ed=td.querySelector('input');
      if(ed){ ed.focus(); return 'ALREADY_EDITOR_FOCUSED' }
      if(!lazy) return 'NO_LAZY';
      lazy.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'ACTIVATED'
    })()`))
    await sleep(400)
    await evalOnce(`(function(){var trs=[].slice.call(document.querySelectorAll('.el-table__row')).filter(function(r){return r.querySelector('.cell-lazy, .inline-ref-editor, td .el-input, td .el-select, td .el-switch')});var tr=trs[trs.length-1];var ths=[].slice.call(document.querySelectorAll('.el-table__header th'));var idx=-1;ths.forEach(function(th,i){if((th.textContent||'').indexOf('库位地址')>=0&&idx<0)idx=i});var td=tr.querySelectorAll('td')[idx];var inp=td.querySelector('input');if(inp){inp.focus();return 'F'}return 'N'})()`)
    for (const ch of ['A', '1']) {
      await pressKey(ch)
      await sleep(300)
      console.log(`   按'${ch}' →`, await cellState('库位地址'))
    }

    // ⑥ 截图留证
    await send('Page.captureScreenshot', {}).then(async (r) => {
      if (r.result && r.result.data) { fs.writeFileSync(shot, Buffer.from(r.result.data, 'base64')); console.log('⑥ 截图:', shot) }
    })
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
