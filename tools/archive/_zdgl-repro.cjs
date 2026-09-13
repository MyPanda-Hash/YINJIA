/* 诊断脚本:复现「点击数据字典白屏」,捕获 console 错误/未捕获异常与渲染耗时
   用法: node _zdgl-repro.cjs [baseUrl] [panelCode...]
   默认: http://localhost:8090 ZDGL DEPT                                        */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require(path.join(__dirname, 'node_modules', 'ws'))

const PORT = 9345
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const LIST = process.argv.slice(3).length ? process.argv.slice(3) : ['ZDGL', 'DEPT']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const login = await loginRes.json()
  const token = login.data.token
  const user = login.data.user

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-zdgl-'))
  const edge = spawn(
    EDGE,
    ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'],
    { stdio: 'ignore' }
  )
  await sleep(2500)
  try {
    const newRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
    const tab = await newRes.json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })

    let seq = 0
    const pending = new Map()
    const events = []
    ws.on('message', (data) => {
      let m
      try { m = JSON.parse(data.toString()) } catch { return }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        events.push({ kind: 'console', text: (m.params.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 600) })
      }
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails || {}
        events.push({ kind: 'exception', text: (d.exception && d.exception.description) || d.text || '' })
      }
    })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evalOnce = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 60; i++) { await sleep(200); if (await evalOnce('document.readyState') === 'complete') { await sleep(500); return } }
    }
    await send('Page.enable'); await send('Runtime.enable')

    await navigate(`${BASE}/#/login`)
    await evalOnce(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); 'ok'`)

    for (const p of LIST) {
      events.length = 0
      await navigate('about:blank')
      const t0 = Date.now()
      await navigate(`${BASE}/#/panelx/list/${p}`)
      let rendered = false
      let elapsed = 0
      for (let i = 0; i < 80; i++) {
        await sleep(250)
        if (await evalOnce(`document.querySelectorAll('.el-table__row').length > 0 || !!document.querySelector('.el-empty')`)) { rendered = true; elapsed = Date.now() - t0; break }
      }
      const info = await evalOnce(`(function(){var a=document.querySelector('#app');return JSON.stringify({appLen:a?a.innerHTML.length:0,text:(document.body.innerText||'').replace(/\\s+/g,' ').slice(0,160)})})()`)
      const dom = await evalOnce(`(function(){var c=function(s){return document.querySelectorAll(s).length};return JSON.stringify({all:document.getElementsByTagName('*').length,tr:c('tr'),row:c('.el-table__row'),cell:c('.el-table__cell'),select:c('.el-select'),option:c('.el-select-dropdown__item'),input:c('input'),btn:c('button'),svg:c('svg'),span:c('span'),div:c('div'),label:c('label')})})()`)
      console.log(`\n===== ${p} =====`)
      console.log(`渲染: ${rendered ? '成功' : '未渲染(疑似白屏)'}   耗时: ${rendered ? elapsed + ' ms' : '>' + (Date.now() - t0) + ' ms'}`)
      console.log(`DOM: ${info}`)
      console.log(`节点统计: ${dom}`)
      const probe = await evalOnce(`(function(){var c=document.querySelector('.el-table__row td .cell-lazy');if(!c)return 'NO_LAZY_CELL';var t=(c.textContent||'').trim();c.click();return 'clicked:'+t.slice(0,12)})()`)
      await sleep(500)
      const after = await evalOnce(`(function(){var e=document.querySelectorAll('.el-table__row td .el-input,.el-table__row td .el-select,.el-table__row td .el-switch,.el-table__row td .el-input-number').length;var l=document.querySelectorAll('.el-table__row td .cell-lazy').length;return JSON.stringify({editors:e,lazyLeft:l})})()`)
      console.log(`交互探针: ${probe}  →  ${after}`)
      const after2 = await evalOnce(`(function(){
        var ed=document.querySelector('.el-table__row td .el-select, .el-table__row td .el-input, .el-table__row td .el-switch, .el-table__row td .el-input-number');
        var kind=null, val=null;
        if(ed){
          var cls=(ed.className||'').split(' ');
          kind=cls.filter(function(c){return c.indexOf('el-select')===0||c.indexOf('el-input')===0||c.indexOf('el-switch')===0})[0]||cls[0];
          var inp=ed.querySelector('input');
          if(inp) val=inp.value;
          else if(ed.classList.contains('el-switch')) val=String(ed.classList.contains('is-checked'));
        }
        return JSON.stringify({编辑器类型:kind, 输入框值:val, 显示文本:(ed?ed.textContent:'').trim().slice(0,20)});
      })()`)
      await sleep(500)
      const after3 = await evalOnce(`JSON.stringify({editorsAfterSecondClick:document.querySelectorAll('.el-table__row td .el-input,.el-table__row td .el-select,.el-table__row td .el-switch,.el-table__row td .el-input-number').length, lazyLeft:document.querySelectorAll('.el-table__row td .cell-lazy').length})`)
      console.log(`编辑器绑定: ${after2}  →  切换后: ${after3}`)
      if (events.length) { console.log(`错误 ${events.length} 条:`); events.slice(0, 6).forEach((e) => console.log(`  [${e.kind}] ${e.text.replace(/\n/g, '\n      ')}`)) }
      else console.log('无 console 错误 / 未捕获异常')
    }
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
