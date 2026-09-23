/**
 * 临时探针(2026-09-22):登录页回归 —— 改了 user.login 的账套落定逻辑、
 * 并移除了登录页里对 switchFactory(已改成"重登"语义)的调用,必须证明登录流程没坏、
 * 且**只发一次登录请求**(重复登录会在 yj_usage_log 里多记一条,调用方用库计数比对)。
 * 用法: node --experimental-websocket tools/archive/_probe-login-regress.cjs [FRONT] [FACTORY]
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const FRONT = process.argv[2] || 'http://localhost:5173'
const FACTORY = process.argv[3] || ''
const PORT = 9373
const CANDS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
]
const EDGE = CANDS.find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const chk = (n, ok, ex) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + n + (ex === undefined ? '' : '  → ' + JSON.stringify(ex))); if (!ok) fails++ }

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'login-regress-'))
  const edge = spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore' })
  try {
    let target = null
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(300)
      try {
        const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
        target = list.find((t) => t.type === 'page')
      } catch { /* not ready */ }
    }
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let id = 0
    const pend = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
    const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
      if (r.result && r.result.exceptionDetails) console.log('  [eval error] ' + r.result.exceptionDetails.text)
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: `${FRONT}/#/login` })
    await sleep(3000)   // 等工厂清单加载

    const opts = await evaluate(`[...document.querySelectorAll('.el-select__wrapper, .el-select')].length`)
    chk('登录页渲染出工厂下拉', opts > 0, opts)

    const setInput = async (idx, value) => {
      await evaluate(`(() => { const i = document.querySelectorAll('.el-form input')[${idx}]; const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(i, ${JSON.stringify(value)}); i.dispatchEvent(new Event('input',{bubbles:true})); return 'ok' })()`)
      await sleep(250)
    }
    await setInput(0, 'admin')
    await setInput(1, '123456')

    if (FACTORY) {
      // 选指定账套(默认已是首个):点开下拉再点选项
      await evaluate(`(() => { const w = document.querySelector('.el-select__wrapper') || document.querySelector('.el-select'); w.click(); return 'ok' })()`)
      await sleep(700)
      const picked = await evaluate(`(() => { const o = [...document.querySelectorAll('.el-select-dropdown__item')].find(e => e.innerText.includes(${JSON.stringify(FACTORY === 'YJ_TEST' ? '测试库' : 'YINJIA-MES')})); if (!o) return 'NOT-FOUND'; o.click(); return 'clicked' })()`)
      chk('选定账套 ' + FACTORY, picked === 'clicked', picked)
      await sleep(500)
    }

    const before = await evaluate(`(() => { const s = document.querySelector('.login-submit'); return s ? s.innerText.trim() : 'NO-BTN' })()`)
    chk('提交按钮就位', before.includes('进入系统'), before)
    await evaluate(`document.querySelector('.login-submit').click(); 'ok'`)
    await sleep(6000)

    const after = await evaluate(`(() => {
      const t = localStorage.getItem('mes_token') || ''
      const u = JSON.parse(localStorage.getItem('mes_user') || '{}')
      const f = JSON.parse(localStorage.getItem('mes_factory') || 'null')
      let claim = null
      try { claim = JSON.parse(atob(t.split('.')[1])).factory } catch (e) { claim = 'DECODE-FAIL' }
      return {
        hash: location.hash,
        claim,
        userFactory: u.factory,
        cachedFactory: f && f.code,
        topName: (document.querySelector('.factory .factory-name') || {}).innerText,
        err: (document.querySelector('.login-err, .el-form-item__error') || {}).innerText || '',
      }
    })()`)
    const want = FACTORY || 'YJ'
    chk('登录后进入系统(不再停在登录页)', after.hash.includes('/dashboard'), after.hash)
    chk('令牌声明的账套 = ' + want, after.claim === want, after.claim)
    chk('mes_user.factory 与令牌一致', after.userFactory === want, after.userFactory)
    chk('mes_factory 缓存与令牌一致', after.cachedFactory === want, after.cachedFactory)
    chk('顶栏账套名正确', want === 'YJ_TEST' ? after.topName === 'YINJIA-MES·测试库' : after.topName === 'YINJIA-MES', after.topName)
  } finally {
    edge.kill()
  }
  console.log(fails ? '\n结果:' + fails + ' 项未通过' : '\n结果:全部通过')
  process.exit(fails ? 1 : 0)
}
main().catch((e) => { console.error('FAIL: ' + (e && e.message)); process.exit(1) })
