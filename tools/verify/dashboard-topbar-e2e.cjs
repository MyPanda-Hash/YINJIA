/**
 * 探针:顶栏「服务到期 2027-08-13」是否已去掉(测试账套 YJ_TEST)
 * 只读顶栏中区文本 + 截图;顺带断言邻居没被误删(登录日期/账号仍在)。
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const BASE = 'http://127.0.0.1:8090'
const API = BASE + '/api'
const PORT = 9361
const OUT = path.join(process.env.TEMP, 'mes-topbar')
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const chk = (id, name, ok, detail) => {
  console.log(`  ${ok ? '\u2713' : '\u2717'} [${id}] ${name}${detail === undefined ? '' : '  → ' + detail}`)
  if (!ok) fails++
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const lr = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })
  const lj = await lr.json()
  const tok = lj?.data?.token, user = lj?.data?.user
  if (!tok) throw new Error('登录失败')

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'topbar-'))
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' })
  try {
    let target = null
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(300)
      try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page') } catch {}
    }
    if (!target) throw new Error('CDP 未就绪')
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let id = 0; const pend = new Map()
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
    const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
    const ev = async (x) => {
      const r = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2000)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(tok)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-10-15'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
    await send('Page.navigate', { url: BASE + '/#/dashboard' }); await sleep(5000)

    const txt = await ev(`(document.querySelector('.t-center') || {}).innerText || ''`)
    console.log('[顶栏中区文本] ' + JSON.stringify(txt))
    chk('T1', '顶栏不再出现「服务到期」', !txt.includes('服务到期'), txt.replace(/\n/g, ' | '))
    chk('T2', '顶栏不再出现那个到期日期 2027-08-13', !txt.includes('2027-08-13'))
    chk('T3', '邻居没被误删:账号 / 已认证 / 登录日期 仍在',
      txt.includes('admin') && txt.includes('已认证') && txt.includes('登录日期'), txt.replace(/\n/g, ' | '))
    const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true, clip: { x: 0, y: 0, width: 1440, height: 56, scale: 1 } })
    fs.writeFileSync(path.join(OUT, 'topbar.png'), Buffer.from(s.result.data, 'base64'))
    console.log('  shot → ' + path.join(OUT, 'topbar.png'))
    ws.close()
  } finally { edge.kill() }

  console.log('')
  if (fails === 0) console.log('[PASS] 顶栏「服务到期」已去掉')
  else { console.log(`[FAIL] ${fails} 项不符`); process.exit(1) }
}
main().catch((e) => { console.error('FATAL ' + e.message); process.exit(1) })
