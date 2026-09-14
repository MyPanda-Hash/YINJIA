/* 冒烟:使用权限查看分组页面(按账号分类 + 时间本地化 + 单据号列) */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('ws')
const PORT = 9340
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })
  const login = await loginRes.json()
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-usage2-'))
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

    // 分组数量与组标题
    const groupCount = await evaluate(`document.querySelectorAll('.el-collapse-item').length`)
    const groupTitles = await evaluate(`[...document.querySelectorAll('.group-title')].map(el => el.textContent.trim().replace(/\\s+/g,' '))`)
    console.log('groupCount:', groupCount)
    console.log('groupTitles:', JSON.stringify(groupTitles))

    // 第一个展开组:表格行 + 列头 + 首行时间格式
    const headers = await evaluate(`[...document.querySelectorAll('.el-table__header th')].map(th => th.textContent.trim()).filter(Boolean)`)
    console.log('headers:', JSON.stringify(headers))
    const firstRow = await evaluate(`[...document.querySelectorAll('.el-table__body tr')][0]?.textContent?.trim().replace(/\\s+/g,' ')`)
    console.log('firstRow:', firstRow)
    const timeCell = await evaluate(`document.querySelector('.el-table__body tr td')?.textContent.trim()`)
    console.log('timeCell:', timeCell)
    const timeFormatOk = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timeCell || '')
    console.log('time format (YYYY-MM-DD HH:mm:ss):', timeFormatOk)

    const pass = groupCount >= 1 && headers.includes('单据号') && headers.includes('操作时间') && timeFormatOk
    console.log('RESULT:', pass ? 'PASS' : 'FAIL')
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile,{recursive:true,force:true}) } catch {} }
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
