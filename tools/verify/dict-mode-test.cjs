/* 验证下拉框字段双模:DISPATCH 业务类型(2 条)=下拉;MANU_ORDER 测试程序(临时 25 条)=弹窗 */
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

    // 2) MANU_ORDER 表单页:测试程序(临时 25 条)→ 应为弹窗控件
    await navigate('http://localhost:5173/#/panelx/form/MANU_ORDER')
    await sleep(4000)
    const manuCtl = await evaluate(`(() => {
      const fields = [...document.querySelectorAll('.field')]
      const f = fields.find(el => (el.querySelector('label')?.textContent || '').includes('测试程序'))
      if (!f) return 'NO-FIELD'
      if (f.querySelector('.el-select')) return 'select'
      if (f.querySelector('.ref-ctl')) return 'dialog-ctl'
      return 'OTHER'
    })()`)
    console.log('MANU_ORDER 测试程序(25条):', manuCtl)

    // 3) 点击弹窗按钮 → 检查弹窗列表项数 = 25
    if (manuCtl === 'dialog-ctl') {
      await evaluate(`(() => { const f = [...document.querySelectorAll('.field')].find(el => (el.querySelector('label')?.textContent || '').includes('测试程序')); f?.querySelector('.ref-btn')?.click(); return 'clicked' })()`)
      await sleep(1200)
      const listCount = await evaluate(`document.querySelectorAll('.dict-pick-item').length`)
      const dialogVisible = await evaluate(`!!document.querySelector('.el-dialog') && [...document.querySelectorAll('.el-dialog')].some(d => d.offsetParent !== null)`)
      console.log('dict dialog visible:', dialogVisible, '| items:', listCount)
      // 4) 搜索过滤:输入 测试项05 → 应剩 1 项
      await evaluate(`(() => { const inp = document.querySelector('.dict-pick-search input'); if (inp) { const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(inp, '测试项05'); inp.dispatchEvent(new Event('input', { bubbles: true })); } return 'typed' })()`)
      await sleep(800)
      const filtered = await evaluate(`document.querySelectorAll('.dict-pick-item').length`)
      console.log('after search 测试项05:', filtered, 'item(s)')
      // 5) 点击选中 → 字段回填
      await evaluate(`document.querySelector('.dict-pick-item')?.click()`)
      await sleep(800)
      const filled = await evaluate(`(() => { const f = [...document.querySelectorAll('.field')].find(el => (el.querySelector('label')?.textContent || '').includes('测试程序')); return f?.querySelector('input')?.value || '' })()`)
      console.log('field filled:', filled)
      const pass = listCount === 25 && filtered === 1 && filled === '测试项05'
      console.log('RESULT:', pass ? 'PASS' : 'FAIL')
    } else {
      console.log('RESULT: FAIL (expected dialog-ctl)')
    }
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile,{recursive:true,force:true}) } catch {} }
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
