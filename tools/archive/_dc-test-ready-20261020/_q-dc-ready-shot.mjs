/**
 * _q-dc-ready-shot.mjs — 测试账套「设备配置管理 = 五连齐备」活体取证(2026-10-20)
 *
 * 走 API 登录取 token → 写 localStorage → 直接进 /#/dc/config 截图(绕开登录页账套下拉,
 * 因为 el-select 在此环境点不开)。截 1440 与 375 两档。
 * 用法: node tools/archive/_dc-test-ready-20261020/_q-dc-ready-shot.mjs [http://127.0.0.1:8090]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachCdp } from '../_cdp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9477
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname, 'shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 1) API 登录(测试账套)
const loginRes = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})
const loginJson = await loginRes.json()
const token = loginJson?.data?.token
const user = loginJson?.data?.user
if (!token) { console.log('登录失败:', JSON.stringify(loginJson).slice(0, 300)); process.exit(2) }
console.log('[登录] token 已取,factory =', user?.factory)

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dcready-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
const cdp = await attachCdp(PORT)
await cdp.send('Page.enable'); await cdp.send('Runtime.enable')
const ev = cdp.ev
const waitFor = async (expr, ms = 30000) => { for (let i = 0; i < ms / 250; i++) { if (await ev(expr)) return true; await sleep(250) } return false }
const shot = async (name) => {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64'))
  console.log('[shot]', name)
}
try {
  fs.mkdirSync(OUT, { recursive: true })
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await cdp.send('Page.navigate', { url: `${BASE}/#/login` })
  await waitFor(`document.querySelector('.login-form') !== null`)
  await ev(`(() => {
    localStorage.setItem('mes_token', ${JSON.stringify(token)})
    localStorage.setItem('mes_user', ${JSON.stringify(user)})
    localStorage.setItem('mes_login_date', new Date().toISOString().slice(0, 10))
    localStorage.setItem('mes_factory', JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))
    return 'ok'
  })()`)
  // 必须整页重载:只改 hash 不会重建 pinia store,守卫仍按"未登录"把人踢回登录页
  await cdp.send('Page.navigate', { url: `${BASE}/?r=1#/dc/config` })
  await sleep(5000)
  console.log('[URL]', await ev('location.href'))
  // 登录态建立后再做一次应用内跳转(直接整页进 /dc/config 会被守卫按"未登录/无权限"踢到桌面)
  await ev(`(location.hash = '#/dc/config', 'ok')`)
  await sleep(4000)
  console.log('[URL2]', await ev('location.href'))
  console.log('[正文]', await ev(`(document.body.innerText||'').replace(/\\s+/g,' ').slice(0,200)`))
  console.log('[标题]', await ev(`(document.querySelector('.dc-title')||{}).textContent||'(无)'`))
  console.log('[KPI]', await ev(`[...document.querySelectorAll('.dc-kpi')].map(e=>e.innerText.replace(/\\s+/g,' ')).join(' | ')`))
  console.log('[表头/首行]', await ev(`(() => { const r=document.querySelector('.dc-card .el-table__body tr'); return r? r.innerText.replace(/\\s+/g,' ').slice(0,200):'(无行)' })()`))
  await shot('dc-config-ready-1440.png')
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true })
  await sleep(1200)
  await shot('dc-config-ready-375.png')
} finally {
  try { edge.kill() } catch {}
}
