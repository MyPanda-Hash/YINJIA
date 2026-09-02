/* 验证:tt() 实时自动机翻——删除词条后面板列头自动补齐目标语言 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('ws')
const PORT = 9347
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })
  const login = await loginRes.json()
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-mt-'))
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

    await navigate(BASE + '/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); localStorage.setItem('mes_locale', 'zh-TW'); 'ok'`)
    await navigate('about:blank')
    await navigate(BASE + '/#/panelx/list/RD_FILTER_EFF')
    await sleep(5000)

    // 第 0 秒(机翻异步前):可能中文
    const h0 = await evaluate(`[...document.querySelectorAll('.el-table__header th')].map(th => th.textContent.trim()).filter(Boolean).slice(0, 8)`)
    console.log('T+0 headers:', JSON.stringify(h0))
    // 等 3.5s(tt miss → 500ms 去抖 → /dict 机翻 → merge → 重渲)
    await sleep(3500)
    const h1 = await evaluate(`[...document.querySelectorAll('.el-table__header th')].map(th => th.textContent.trim()).filter(Boolean).slice(0, 8)`)
    console.log('T+3.5s headers:', JSON.stringify(h1))

    const trad = /[\u4e00-\u9fff]/
    const containsIt = h1.some(h => h.includes('濾') || h.includes('濁') || h.includes('前') || h.includes('後'))
    const pass = h1.some(h => /[濾|濁|後]/.test(h))
    console.log('RESULT:', pass ? 'PASS (auto-MT worked)' : (containsIt ? 'PASS?' : 'FAIL'))
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile,{recursive:true,force:true}) } catch {} }
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
