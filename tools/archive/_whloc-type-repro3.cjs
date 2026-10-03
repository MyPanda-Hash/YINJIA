/* 诊断②:WHLOC 明细单元格逐字符输入观测(v2)
   改进:聚焦点=被点击单元格内的 input;每字符后输出 全行编辑器分布+激活元素+值;加硬超时 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require(path.join(__dirname, '..', 'node_modules', 'ws'))

const PORT = 9349
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:5173'
const PANEL = process.argv[3] || 'WHLOC'
const COL = process.argv[4] || '库位编码'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const login = await loginRes.json()
  const token = login.data.token
  const user = login.data.user

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-whloc2-'))
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
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
        errors.push((m.params.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 300))
      if (m.method === 'Runtime.exceptionThrown') errors.push('EXC:' + ((m.params.exceptionDetails || {}).text || ''))
    })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evalOnce = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result && r.result.exceptionDetails) return 'EVAL_ERR:' + (r.result.exceptionDetails.text || '')
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 50; i++) { await sleep(200); if (await evalOnce('document.readyState') === 'complete') { await sleep(600); return } }
    }
    await send('Page.enable'); await send('Runtime.enable')

    await navigate(`${BASE}/#/login`)
    await evalOnce(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); 'ok'`)
    await navigate('about:blank')
    await navigate(`${BASE}/#/panelx/list/${PANEL}`)

    let rows = 0
    for (let i = 0; i < 40; i++) { await sleep(250); rows = await evalOnce(`document.querySelectorAll('.el-table__row').length`); if (rows > 0) break }
    console.log(`[${PANEL}] 行数:`, rows)

    // 若无真实数据行(纯占位),点「新增数据」
    let real = await evalOnce(`(function(){var trs=[].slice.call(document.querySelectorAll('.el-table__row'));var n=0;trs.forEach(function(tr){if(tr.querySelector('.cell-lazy')||tr.querySelector('td .el-input'))n++});return n})()`)
    if (true) { // 强制走新增数据流程
      const clicked = await evalOnce(`(function(){var bs=[].slice.call(document.querySelectorAll('button'));var b=bs.find(function(x){return (x.textContent||'').indexOf('新增数据')>=0});if(!b)return 'NO_BTN';b.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'CLICKED'})()`)
      console.log('新增数据:', clicked)
      await sleep(700)
    }

    // 行内结构快照(编辑器 vs 纯文本格分布)
    const snap = await evalOnce(`(function(){
      var tr=document.querySelector('.el-table__row');
      if(!tr) return 'NO_ROW';
      var tds=[].slice.call(tr.querySelectorAll('td'));
      return JSON.stringify(tds.map(function(td){
        var kind='text';
        if(td.querySelector('.el-input')||td.querySelector('.el-select')||td.querySelector('.el-switch')||td.querySelector('.el-input-number'))kind='EDITOR';
        if(td.querySelector('input'))kind+='+input';
        if(td.querySelector('.cell-lazy'))kind='LAZY';
        return kind+':'+(td.textContent||'').trim().slice(0,10);
      }))
    })()`)
    console.log('首行结构:', snap)

    // 激活目标列(找表头列号→找有 cell-lazy 的行)
    const act = await evalOnce(`(function(){
      var ths=[].slice.call(document.querySelectorAll('.el-table__header th'));
      var idx=-1; ths.forEach(function(th,i){ if((th.textContent||'').indexOf('${COL}')>=0 && idx<0) idx=i });
      if(idx<0) return 'NO_COL:'+ths.map(function(t){return (t.textContent||'').trim()}).join('|');
      var trs=[].slice.call(document.querySelectorAll('.el-table__row'));
      for(var r=0;r<trs.length;r++){
        var tds=trs[r].querySelectorAll('td'); var td=tds[idx]; if(!td) continue;
        var lazy=td.querySelector('.cell-lazy');
        if(lazy){ lazy.dispatchEvent(new MouseEvent('click',{bubbles:true})); window.__actTd=td; window.__actRow=r; return 'ACT row'+r+' col'+idx }
        if(td.querySelector('input')){ window.__actTd=td; window.__actRow=r; return 'ALREADY_EDITOR row'+r }
      }
      return 'NO_TARGET'
    })()`)
    console.log('激活:', act)
    await sleep(400)

    // 聚焦:激活单元格内的 input(el-input/el-input-number 内核)
    const focused = await evalOnce(`(function(){var td=window.__actTd;if(!td)return 'NO_TD';var inp=td.querySelector('input');if(!inp)return 'TD_NO_INPUT:'+(td.textContent||'').slice(0,20);inp.focus();inp.select?inp.select():0;return 'FOCUSED val='+inp.value})()`)
    console.log('聚焦:', focused)

    for (const ch of ['K', 'W', '1']) {
      await send('Input.insertText', { text: ch })
      await sleep(400)
      const state = await evalOnce(`(function(){
        var td=window.__actTd; var row=window.__actRow;
        var rowsAll=document.querySelectorAll('.el-table__row');
        var tr=rowsAll[row];
        var stillEditor = td && !!td.querySelector('input');
        var inp = td ? td.querySelector('input') : null;
        var ae=document.activeElement;
        var edCount = document.querySelectorAll('.el-table__row td .el-input, .el-table__row td .el-select, .el-table__row td .el-switch, .el-table__row td .el-input-number').length;
        return JSON.stringify({ tdStillEditor: stillEditor, tdVal: inp? inp.value : '(td无input)', rowAlive: !!tr && tr.querySelectorAll('td').length, activeIsTdInput: !!(ae && td && td.contains(ae)), activeCls: String(ae && ae.className || '').slice(0,30), editorsTotal: edCount })
      })()`)
      console.log(`  输入'${ch}' →`, state)
    }

    console.log('\n===== console 错误 =====')
    if (errors.length) errors.slice(0, 10).forEach((e) => console.log(' ', e.replace(/\n/g, '\n  ')))
    else console.log(' 无')
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
