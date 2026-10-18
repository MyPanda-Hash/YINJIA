/**
 * _q-erp-config.mjs — ERP集成配置清单「配置错误」排查(2026-10-18 用户报障)
 *
 * 真实登录 → 打开 /#/erp/integConfig → 采集:
 *   ① /api/erp/integ/* 的真实 HTTP 状态与响应体(区分 200/403/500);
 *   ② 浏览器 console 报错与未捕获异常;
 *   ③ 页面可见文案(是否出现「配置加载失败」/el-alert/ECharts 报错等);
 *   ④ 1440 截图。
 *
 * 用法(仓库根):node tools/archive/_erp-integ-20261018/_q-erp-config.mjs [http://127.0.0.1:8090]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachCdp } from '../_cdp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9431
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname, 'shots')
// 第二个参数 = 登录工厂(默认正式账套;传「测试库」走 YINJIA-MES·测试库)
const ADMIN = { userName: 'admin', password: '123456', factory: process.argv[3] || 'YINJIA-MES' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-erpcfg-'))
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' })
  await sleep(2500)
  let cdp = null
  try {
    const net = []
    const consoleErrs = []
    const pageErrs = []
    const bodies = new Map()
    const reqUrl = new Map()
    cdp = await attachCdp(PORT, undefined, (m) => {
      if (m.method === 'Network.responseReceived' && /\/api\/erp\//.test(m.params.response.url)) {
        net.push(m.params.response.status + ' ' + new URL(m.params.response.url).pathname)
        reqUrl.set(m.params.requestId, m.params.response.url)
      }
      if (m.method === 'Network.loadingFinished' && reqUrl.has(m.params.requestId)) {
        cdp.send('Network.getResponseBody', { requestId: m.params.requestId })
          .then((r) => bodies.set(reqUrl.get(m.params.requestId), r.result.body))
          .catch(() => {})
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        consoleErrs.push((m.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ').slice(0, 400))
      }
      if (m.method === 'Runtime.exceptionThrown') {
        pageErrs.push((m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || '').slice(0, 400))
      }
    })
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable')
    const ev = cdp.ev
    const waitFor = async (expr, ms = 25000) => {
      for (let i = 0; i < ms / 250; i++) { if (await ev(expr)) return true; await sleep(250) }
      return false
    }
    const shot = async (name, w, h) => {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 })
      await sleep(800)
      const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
      fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64'))
      console.log('   截图', name + '.png')
    }

    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
    await cdp.send('Page.navigate', { url: `${BASE}/#/login` })
    await waitFor(`document.querySelectorAll('.login-form input').length >= 2`, 25000)
    await ev(`(() => {
      const ins = [...document.querySelectorAll('.login-form input')]
      const set = (el, v) => { el.focus(); el.value = v
        el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
      set(ins[0], ${JSON.stringify(ADMIN.userName)}); set(ins[1], ${JSON.stringify(ADMIN.password)}); return ins.length })()`)
    await ev(`(() => { const s = document.querySelector('.login-form .el-select'); if (s) s.click(); return 1 })()`)
    await sleep(700)
    await ev(`(() => {
      const items = [...document.querySelectorAll('.el-select-dropdown__item')].filter((e) => e.offsetParent)
      const t = items.find((i) => i.textContent.trim().indexOf(${JSON.stringify(ADMIN.factory)}) >= 0)
      if (t) t.click(); return 1 })()`)
    await sleep(500)
    await ev(`(() => { const b = document.querySelector('.login-submit'); if (b) b.click(); return 1 })()`)
    const ok = await waitFor(`location.hash.indexOf('/login') < 0`, 30000)
    console.log('[login]', ok ? 'OK' : 'FAIL')
    console.log('[factory]', await ev(`localStorage.getItem('mes_factory')`))
    if (!ok) process.exit(1)

    await ev(`(location.hash = '#/erp/integConfig', 'ok')`)
    await sleep(4000)
    await shot('erp-integ-1440', 1440, 1000)

    const text = await ev(`(() => {
      const box = document.querySelector('.erp-integ') || document.querySelector('.app-main') || document.body
      return (box.innerText || '').replace(/\\n{2,}/g, '\\n').slice(0, 2500) })()`)
    console.log('\n=== 页面文案(前 2500 字) ===\n' + text)

    const dom = await ev(`(() => {
      const q = (s) => document.querySelectorAll(s).length
      const msgs = [...document.querySelectorAll('.el-message, .el-message-box, .el-alert, .el-notification')]
        .filter((e) => e.offsetParent).map((e) => e.innerText.replace(/\\s+/g, ' ').trim())
      return JSON.stringify({
        cards: q('.ei-card'), cats: q('.ei-cat'), stats: [...document.querySelectorAll('.ei-stat .n')].map((e) => e.textContent.trim()),
        detailBlocks: q('.ei-block'), mapRows: q('.map-table .el-table__row'), devRows: q('.dev-table .el-table__row'),
        msg: msgs, empty: q('.ei-empty'),
      }) })()`)
    console.log('\n=== DOM 计数 ===\n' + dom)

    console.log('\n=== /api/erp/* 网络 ===\n' + (net.length ? net.join('\n') : '(无请求)'))
    for (const [u, b] of bodies) {
      console.log('  body ' + new URL(u).pathname + ' → ' + String(b).slice(0, 400))
    }
    console.log('\n=== console.error ===\n' + (consoleErrs.length ? consoleErrs.join('\n---\n') : '(无)'))
    console.log('\n=== 未捕获异常 ===\n' + (pageErrs.length ? pageErrs.join('\n---\n') : '(无)'))

    await shot('erp-integ-768', 768, 1200)
    await shot('erp-integ-375', 375, 1400)
  } finally {
    if (cdp) cdp.close?.()
    edge.kill()
  }
}

main().catch((e) => { console.error('探针异常:', e); process.exit(1) })
