/* 诊断:复现「库位档案 WHLOC 明细单元格打字即退出编辑」报告
   用法: node _whloc-type-repro.cjs [baseUrl]
   默认前端: http://localhost:5173(vite dev,实时源码)
   动作:登录注入 → WHLOC → 点「新增数据」→ 激活 库位编码 单元格 → 逐字符 Input.insertText,
        每字符后检查: 编辑器是否仍挂载 / activeElement 是否仍是输入框 / 输入框当前值;
        对照组:WH 面板 仓库编码 单元格同样流程。捕获 console 错误。 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require(path.join(__dirname, '..', 'node_modules', 'ws'))

const PORT = 9347
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const login = await loginRes.json()
  const token = login.data.token
  const user = login.data.user

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-whloc-'))
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
      if (m.method === 'Runtime.exceptionThrown')
        errors.push('EXC:' + ((m.params.exceptionDetails || {}).text || ''))
    })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evalOnce = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result && r.result.exceptionDetails) return 'EVAL_ERR:' + (r.result.exceptionDetails.text || '')
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 60; i++) { await sleep(200); if (await evalOnce('document.readyState') === 'complete') { await sleep(600); return } }
    }
    await send('Page.enable'); await send('Runtime.enable')

    await navigate(`${BASE}/#/login`)
    await evalOnce(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); 'ok'`)

    // 在指定面板上:新增数据 → 激活目标单元格 → 逐字符输入并观测
    async function typeTest(panelCode, colLabel, useAddRow) {
      console.log(`\n===== ${panelCode} · ${colLabel} =====`)
      await navigate('about:blank') // 强制整页重载:Pinia user store 只在启动时读 localStorage
      await navigate(`${BASE}/#/panelx/list/${panelCode}`)
      let rows = 0
      for (let i = 0; i < 40; i++) { await sleep(250); rows = await evalOnce(`document.querySelectorAll('.el-table__row').length`); if (rows > 0) break }
      if (rows === 0) {
        const dbg = await evalOnce(`(function(){return JSON.stringify({href:location.href,title:document.title,tok:!!localStorage.getItem('mes_token'),body:(document.body.innerText||'').replace(/\\s+/g,' ').slice(0,180)})})()`)
        console.log('渲染失败诊断:', dbg)
      }
      console.log('行数:', rows)
      if (useAddRow) {
        // 点「新增数据」按钮(档案空表时唯一入口;占位行不可编辑)
        const clicked = await evalOnce(`(function(){var bs=[].slice.call(document.querySelectorAll('button'));var b=bs.find(function(x){return (x.textContent||'').indexOf('新增数据')>=0});if(!b)return 'NO_BTN';b.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'CLICKED'})()`)
        console.log('新增数据:', clicked)
        await sleep(600)
      }
      // 找第一个非占位行里目标列的 cell-lazy 格并点击激活
      const act = await evalOnce(`(function(){
        var ths=[].slice.call(document.querySelectorAll('.el-table__header th'));
        var idx=-1; ths.forEach(function(th,i){ if((th.textContent||'').indexOf('${colLabel}')>=0 && idx<0) idx=i });
        if(idx<0) return 'NO_COL';
        var trs=[].slice.call(document.querySelectorAll('.el-table__row'));
        for(var r=0;r<trs.length;r++){
          var tds=trs[r].querySelectorAll('td');
          var td=tds[idx]; if(!td) continue;
          var lazy=td.querySelector('.cell-lazy');
          if(lazy){ lazy.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'ACT row'+r+' col'+idx }
        }
        return 'NO_EDITABLE_CELL'
      })()`)
      console.log('激活:', act)
      await sleep(400)
      // 焦点进输入框
      const focused = await evalOnce(`(function(){var inp=document.querySelector('.el-table__row td .el-input input, .el-table__row td .el-input-number input');if(!inp)return 'NO_INPUT';inp.focus();return 'FOCUSED tag='+inp.tagName})()`)
      console.log('聚焦:', focused)
      for (const ch of ['K', 'W', '-', '0', '0', '1']) {
        await send('Input.insertText', { text: ch })
        await sleep(350)
        const state = await evalOnce(`(function(){
          var ed=document.querySelectorAll('.el-table__row td .el-input,.el-table__row td .el-select,.el-table__row td .el-switch,.el-table__row td .el-input-number').length;
          var inp=document.querySelector('.el-table__row td .el-input input');
          var ae=document.activeElement;
          return JSON.stringify({editors:ed, activeIsInput: !!(ae && ae.tagName==='INPUT'), activeCls: ae? String(ae.className).slice(0,40):'', val: inp? inp.value : '(无输入框)'})
        })()`)
        console.log(`  输入'${ch}' →`, state)
      }
    }

    await typeTest('WHLOC', '库位编码', true)
    await typeTest('WHLOC', '库位地址', false)
    await typeTest('WH', '仓库地址', false) // 对照组:老档案面板文本列

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
