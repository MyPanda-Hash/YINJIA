/* 参照字段双模 UI 验证:KHDA(24 行,超20应出现下拉) vs CKDA(22 行,也超20) */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const PORT = 9334
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })
  const login = await loginRes.json()
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ref-'))
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
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i=0;i<40;i++) { await sleep(300); if (await evaluate('document.readyState')==='complete') { await sleep(800); return } } }
    await send('Page.enable'); await send('Runtime.enable')

    for (const panel of ['KHDA', 'CKDA', 'RKD']) {
      await navigate('http://localhost:5173/#/login')
      await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); 'ok'`)
      await navigate('about:blank')
      await navigate(`http://localhost:5173/#/panelx/list/${panel}`)
      await sleep(4000)
      const title = await evaluate('document.title')
      // 全页面查找:el-select(下拉)和 readonly input+按钮(弹窗触发)
      const allSelect = await evaluate(`[...document.querySelectorAll('.el-select')].length`)
      const refDialogBtn = await evaluate(`[...document.querySelectorAll('.el-button[title="打开参照"]')].length`)
      const headerArea = await evaluate(`document.querySelector('.header-fields') ? document.querySelector('.header-fields').children.length : -1`)
      const refSelectDiv = await evaluate(`[...document.querySelectorAll('.query-ref-select')].length`)
      const status = await evaluate(`document.querySelector('.doc-status')?.textContent?.trim() || ''`)
      console.log(`[${panel}] title=${title} status=${status} headerFields=${headerArea} elSelect=${allSelect} refSelectDiv=${refSelectDiv} refDialogBtn=${refDialogBtn}`)
    }
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile,{recursive:true,force:true}) } catch {} }
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
