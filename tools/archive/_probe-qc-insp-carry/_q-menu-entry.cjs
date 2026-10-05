/* 一次性核对:菜单里能看到新面板入口「来料检验要求(系列)」并能点进面板(走菜单,不走路由直达)。
   用法:node tools/archive/_probe-qc-insp-carry/_q-menu-entry.cjs [前端地址,默认 8090] */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9370
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://127.0.0.1:8090/api'
const APP = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-menu-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1500,1200',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tabInfo = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
    const raw = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
    const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i = 0; i < 60; i++) { await sleep(300); if (await raw('document.readyState') === 'complete') { await sleep(1500); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${APP}/#/login`)
    await raw(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${APP}/#/dashboard`)
    await sleep(4000)
    // 展开「品质管理」菜单(文本匹配)
    const opened = await raw(`(() => {
      const el = [...document.querySelectorAll('.nav-item, .menu-item, .el-sub-menu__title, .nav-group, button, div')]
        .filter(e => e.children.length <= 4 && e.innerText.trim() === '品质管理')
      el[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return el.length
    })()`)
    await sleep(1500)
    const opened2 = await raw(`(() => {
      const el = [...document.querySelectorAll('.nav-item, .menu-item, .el-sub-menu__title, button, div')]
        .filter(e => e.children.length <= 4 && e.innerText.trim() === '来料品质')
      el[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return el.length
    })()`)
    await sleep(1500)
    const found = await raw(`document.body.innerText.includes('来料检验要求(系列)')`)
    console.log(`${found ? 'PASS' : 'FAIL'}  菜单里能看到「来料检验要求(系列)」 · 品质管理命中 ${opened} 处 / 来料品质命中 ${opened2} 处`)
    if (!found) {
      console.log('   侧栏文本片段:', String(await raw(`(document.querySelector('.sidebar, .nav, .menu')?.innerText || '').replace(/\\s+/g,' ').slice(0,400)`)))
      process.exitCode = 1
    }
  } finally { edge.kill() }
}
main().catch((e) => { console.error('异常:', e); process.exitCode = 1 })
