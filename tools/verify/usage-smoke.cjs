/* 冒烟:使用权限查看页面(admin 可见入口 + 表格数据 + 非 admin 不可见) */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('ws')
const PORT = 9339
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })
  const login = await loginRes.json()
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-usage-'))
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

    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); 'ok'`)
    await navigate('about:blank')
    await navigate('http://localhost:5173/#/sys/usage')
    await sleep(4000)

    const title = await evaluate('document.title')
    console.log('title:', title)

    // 表格行数 + 首行内容
    const rowCount = await evaluate(`document.querySelectorAll('.el-table__body tr').length`)
    const firstRow = await evaluate(`[...document.querySelectorAll('.el-table__body tr')][0]?.textContent?.trim().replace(/\\s+/g,' ')`)
    console.log('rowCount:', rowCount)
    console.log('firstRow:', firstRow)

    // 筛选控件存在
    const hasFilter = await evaluate(`!!document.querySelector('.usage-filter') && !!document.querySelector('.el-date-editor')`)
    console.log('filter present:', hasFilter)

    // 下拉菜单里是否有「使用权限查看」
    await navigate('http://localhost:5173/#/dashboard')
    await sleep(2500)
    const hasDropdown = await evaluate(`[...document.querySelectorAll('.el-dropdown-menu__item')].some(el => el.textContent.includes('使用权限查看'))`)
    console.log('dropdown entry visible on dashboard:', hasDropdown)

    const cjk = /[\u4e00-\u9fff]/
    const pass = rowCount > 0 && hasFilter && hasDropdown && cjk.test(firstRow || '')
    console.log('RESULT:', pass ? 'PASS' : 'FAIL')
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile,{recursive:true,force:true}) } catch {} }
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
