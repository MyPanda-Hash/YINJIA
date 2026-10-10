/**
 * 截图(2026-10-15):只重截「报工记录」一张 —— 用**测试账套**登录(有 7 行演示数据)。
 *
 * 为什么单独一张(用户口径):
 *   演示数据按用户要求只造到 HSDZ_MES_TEST(不污染正式账);而截图要能体现"界面有数据"。
 *   用户拍板:**这一张**用测试账套(顶栏会显示「YINJIA-MES·测试库」是预期内的),
 *   其余 17 张用正式账套(顶栏 YINJIA-MES)。
 *
 * 登录口径:POST /auth/login 带 factory='YJ_TEST'(DataSourceRouter.TEST)→ 该 token 后续请求走测试库。
 * 用法: node tools/archive/_shot-mes-report-testledger-1015.mjs [host]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const host = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const OUT = 'tools/archive/_shots-mes-1015'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })

const profile = mkdtempSync(join(tmpdir(), 'edge-rep-'))
const port = 9344
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1600,1000', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' })

let ws, msgId = 0
const pending = new Map()
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) {
      ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
      ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
      break
    }
  } catch {}
  await sleep(500)
}
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })

await send('Page.navigate', { url: host + '/#/login' })
await sleep(3500)

// ⚠ 测试账套:factory=YJ_TEST
const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
if (!lg?.data?.token) { console.error('[FATAL] 测试账套登录失败'); process.exit(1) }
console.log('[login] 测试账套 token 已取')

await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  // 工厂名要与测试账套一致(顶栏显示;不设会回落)
  + `localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))});`
  + `localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
await send('Page.reload', { ignoreCache: true })
await sleep(6500)

await ev(`location.hash = '#/panelx/list/WO_REPORT_LIST'; 'ok'`)
await sleep(7000)

const info = await ev(`(() => {
  const t = document.body.innerText || '';
  const rows = document.querySelectorAll('.el-table__body tbody tr').length;
  return JSON.stringify({ rows, hasDemo: /DEMO-BG/.test(t), logo: (document.querySelector('.logo')||{}).textContent||'' });
})()`)
console.log('[页面]', info)

const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
if (r.result?.data) {
  writeFileSync(join(OUT, '10-报工记录.png'), Buffer.from(r.result.data, 'base64'))
  console.log('[OK] 已覆盖 10-报工记录.png')
}
try { edge.kill() } catch {}
process.exit(0)
