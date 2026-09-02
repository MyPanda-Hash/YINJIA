/* 验证:切换目标语言后,面板列头/标题是否显示目标语言(非中文) */
/* 用法:node i18n-verify-multi.cjs <locale> [panelCode] */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('ws')
const PORT = 9338
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const locale = process.argv[2] || 'ja'
  const panel = process.argv[3] || 'RD_FILTER_EFF'
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })
  const login = await loginRes.json()
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-i18n-'))
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
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); localStorage.setItem('mes_locale', ${JSON.stringify(locale)}); 'ok'`)
    await navigate('about:blank')
    await navigate(`http://localhost:5173/#/panelx/list/${panel}`)
    await sleep(5000)

    const titleHistory = []
    for (let i = 0; i < 8; i++) {
      titleHistory.push(await evaluate('document.title'))
      await sleep(1000)
    }
    const title = titleHistory[titleHistory.length - 1]
    const headers = await evaluate(`[...document.querySelectorAll('.el-table__header th')].map(th => th.textContent.trim()).filter(Boolean).slice(0, 12)`)
    const fieldLabels = await evaluate(`[...document.querySelectorAll('.header-fields .field > label, .fields .field > label')].map(l => l.textContent.trim()).slice(0, 8)`)
    const pageTitle = await evaluate(`(document.querySelector('.page-title')||document.querySelector('.el-page-header__title')||{textContent:''}).textContent.trim()`)
    console.log(`[${locale}] panel=${panel}`)
    console.log('title history:', JSON.stringify(titleHistory))
    console.log('pageTitle:', pageTitle)
    console.log('column headers:', JSON.stringify(headers))
    console.log('field labels:', JSON.stringify(fieldLabels))

    // 断言:按目标语言判断字符集(ja=含假名, ko=含谚文, 其他=不含 CJK)
    const all = headers.concat(fieldLabels).filter(Boolean)
    let pass
    if (locale === 'ja') pass = all.some(h => /[\u3040-\u30ff]/.test(h))
    else if (locale === 'ko') pass = all.some(h => /[\uac00-\ud7af]/.test(h))
    else pass = all.length > 0 && all.every(h => !/[\u4e00-\u9fff]/.test(h))
    console.log('RESULT:', pass ? 'PASS' : 'FAIL (target language not visible)')
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile,{recursive:true,force:true}) } catch {} }
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
