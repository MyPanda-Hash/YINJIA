/* 验证下拉框字段双模:DISPATCH 业务类型(2 条)=下拉。
 * 2026-10-28:另一路「MANU_ORDER 测试程序 25 条 = 弹窗」随生产加工单下架删除(面板已不存在)。 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('ws')
const PORT = 9342
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })
  const login = await loginRes.json()
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dict-'))
  const edge = spawn(EDGE, ['--headless=new','--disable-gpu','--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const newRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
    const tab = await newRes.json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i=0;i<50;i++) { await sleep(300); if (await evaluate('document.readyState')==='complete') { await sleep(1000); return } } }
    await send('Page.enable'); await send('Runtime.enable')

    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); 'ok'`)
    await navigate('about:blank')

    // 1) DISPATCH 表单页:业务类型(2 条)→ 应为 el-select
    await navigate('http://localhost:5173/#/panelx/form/DISPATCH')
    await sleep(4000)
    const dispatchCtl = await evaluate(`(() => {
      const fields = [...document.querySelectorAll('.field')]
      const f = fields.find(el => (el.querySelector('label')?.textContent || '').includes('业务类型'))
      if (!f) return 'NO-FIELD'
      if (f.querySelector('.el-select')) return 'select'
      if (f.querySelector('.ref-ctl')) return 'dialog-ctl'
      return 'OTHER:' + (f.querySelector('input') ? 'input' : f.innerHTML.slice(0,80))
    })()`)
    console.log('DISPATCH 业务类型(2条):', dispatchCtl)

    console.log('RESULT:', dispatchCtl === 'select' ? 'PASS' : 'FAIL (expected select)')
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile,{recursive:true,force:true}) } catch {} }
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
