/**
 * 临时探针(2026-09-22):顶栏"工厂(账套)切换"是否真的切换
 *   用户报:「系统内部左上角的工厂切换是无效使用功能,并未进行切换」。
 *
 * 判定"真的切了"的证据(不靠观感):
 *   ① 令牌声明变化的 JWT payload.factory(YJ → YJ_TEST)—— JwtAuthFilter 就是按它路由的;
 *   ② 服务端事件:登录成功事件按**所选账套**写入 yj_usage_log(UsageLogService:40),
 *      切换后新增行只应出现在目标库,源库行数不变(由调用方先/后查库比对,这里只打印目标状态);
 *   ③ 界面:顶栏名字、mes_user.factory、以及"点同一个账套不弹窗"的守卫。
 *
 * 用法: node --experimental-websocket tools/archive/_probe-factory-switch.cjs [FRONT] [WRONGPWD]
 *   WRONGPWD=1 时只跑"错误密码不得切换"这一步
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const FRONT = process.argv[2] || 'http://localhost:5173'
const WRONG_ONLY = process.argv[3] === '1'
const API = 'http://localhost:8090/api'
const PORT = 9371
const OUT = path.join(process.env.TEMP, 'dash-audit')
const CANDS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
]
const EDGE = CANDS.find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
function chk(name, ok, extra) {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (extra === undefined ? '' : '  → ' + JSON.stringify(extra)))
  if (!ok) fails++
}
const decodeJwt = (t) => {
  try { return JSON.parse(Buffer.from(String(t).split('.')[1], 'base64').toString('utf8')) } catch { return null }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  // 直连基线:分别按两个账套登录,拿到各自令牌里的工厂声明(证明后端按工厂发不同令牌)
  const jwtOf = async (factory) => {
    const r = await fetch(API + '/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ userName: 'admin', password: '123456', factory }),
    })
    const j = await r.json()
    return { token: j.data && j.data.token, user: j.data && j.data.user, claim: decodeJwt(j.data && j.data.token) }
  }
  const prodLogin = await jwtOf('YJ')
  const testLogin = await jwtOf('YJ_TEST')
  console.log('[基线] YJ 令牌声明 factory=' + (prodLogin.claim || {}).factory + ' | YJ_TEST 令牌声明 factory=' + (testLogin.claim || {}).factory)
  chk('基线:两个账套的令牌声明确实不同(说明路由输入不同)', (prodLogin.claim || {}).factory === 'YJ' && (testLogin.claim || {}).factory === 'YJ_TEST')

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-switch-'))
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
    const shot = async (name) => {
      const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
      const f = path.join(OUT, name + '.png')
      if (s.result && s.result.data) fs.writeFileSync(f, Buffer.from(s.result.data, 'base64'))
      console.log('  shot -> ' + f)
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

    // 以"正式账套"进入系统(令牌声明 YJ)
    await send('Page.navigate', { url: `${FRONT}/#/login` }); await sleep(1800)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(prodLogin.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(prodLogin.user))});
localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))});
localStorage.setItem('mes_login_date','2026-09-22'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
    await send('Page.navigate', { url: `${FRONT}/#/dashboard` }); await sleep(4500)
    await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 'x' })()`)
    await sleep(1000)

    const before = await evaluate(`(() => { const t = localStorage.getItem('mes_token'); return { name: (document.querySelector('.factory .factory-name') || {}).innerText, claim: JSON.parse(atob(t.split('.')[1])).factory } })()`)
    chk('切换前:顶栏名字与令牌声明都是正式账套', before.name === 'YINJIA-MES' && before.claim === 'YJ', before)

    const openMenu = async () => {
      await evaluate(`(() => { const f = document.querySelector('.factory'); if (f) f.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); return 'ok' })()`)
      await sleep(800)
      return evaluate(`[...document.querySelectorAll('.el-dropdown-menu__item .factory-item')].map(e => e.innerText.trim())`)
    }
    const items = await openMenu()
    chk('下拉列出两个账套', JSON.stringify(items) === JSON.stringify(['YINJIA-MES', 'YINJIA-MES·测试库']), items)

    // ① 点当前账套:不应弹窗(避免无意义重登)
    await evaluate(`(() => { const it = [...document.querySelectorAll('.el-dropdown-menu__item .factory-item')].find(e => e.innerText.trim() === 'YINJIA-MES'); if (it) it.closest('li').click(); return 'ok' })()`)
    await sleep(900)
    const sameDialog = await evaluate(`document.querySelectorAll('.factory-switch-dialog').length`)
    chk('点当前账套:不弹密码框', sameDialog === 0, sameDialog)

    // ② 点另一个账套:应弹密码框
    await openMenu()
    await evaluate(`(() => { const it = [...document.querySelectorAll('.el-dropdown-menu__item .factory-item')].find(e => e.innerText.trim().includes('测试库')); if (it) it.closest('li').click(); return 'ok' })()`)
    await sleep(1200)
    const dlg = await evaluate(`(() => { const d = document.querySelector('.factory-switch-dialog'); if (!d) return null; return { title: (d.querySelector('.el-dialog__title') || {}).innerText, pair: [...d.querySelectorAll('.fs-name')].map(e => e.innerText.trim()), hint: (d.querySelector('.fs-hint') || {}).innerText.slice(0, 20) } })()`)
    chk('弹窗出现且展示 当前账套 → 目标账套', !!dlg && dlg.pair[0] === 'YINJIA-MES' && dlg.pair[1] === 'YINJIA-MES·测试库', dlg)
    await shot('factory-switch-dialog')

    if (WRONG_ONLY) {
      // ③ 错误密码:不得切换(令牌声明不变、页面不刷新)
      await evaluate(`(() => { const i = document.querySelector('.factory-switch-dialog input'); i.value=''; i.dispatchEvent(new Event('input',{bubbles:true})); return 'ok' })()`)
      await evaluate(`(() => { const i = document.querySelector('.factory-switch-dialog input'); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(i,'wrong-password-xyz'); i.dispatchEvent(new Event('input',{bubbles:true})); return 'ok' })()`)
      await sleep(400)
      await evaluate(`(() => { const b = [...document.querySelectorAll('.factory-switch-dialog .el-dialog__footer button')].find(x => x.innerText.includes('切换')); b.click(); return 'ok' })()`)
      await sleep(3000)
      const after = await evaluate(`(() => { const t = localStorage.getItem('mes_token'); const d = document.querySelector('.factory-switch-dialog'); return { claim: JSON.parse(atob(t.split('.')[1])).factory, err: d ? (d.querySelector('.fs-error') || {}).innerText : 'DIALOG-CLOSED', url: location.hash } })()`)
      chk('错误密码:令牌声明没变(仍 YJ)', after.claim === 'YJ', after.claim)
      chk('错误密码:弹窗留在原地并给出错误', typeof after.err === 'string' && after.err !== 'DIALOG-CLOSED' && after.err.length > 0, after.err)
      await shot('factory-switch-wrong-pwd')
      return
    }

    // ④ 正确密码:真切换 + 整页刷新
    await evaluate(`(() => { const i = document.querySelector('.factory-switch-dialog input'); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(i,'123456'); i.dispatchEvent(new Event('input',{bubbles:true})); return 'ok' })()`)
    await sleep(400)
    await evaluate(`(() => { const b = [...document.querySelectorAll('.factory-switch-dialog .el-dialog__footer button')].find(x => x.innerText.includes('切换')); b.click(); return 'ok' })()`)
    console.log('  已点确认,等待整页刷新…')
    await sleep(9000)
    await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 'x' })()`)
    await sleep(1200)
    const now = await evaluate(`(() => { const t = localStorage.getItem('mes_token'); const u = JSON.parse(localStorage.getItem('mes_user') || '{}'); return { name: (document.querySelector('.factory .factory-name') || {}).innerText, claim: JSON.parse(atob(t.split('.')[1])).factory, userFactory: u.factory, dashText: (document.querySelector('.welcome .meta') || {}).innerText || '' } })()`)
    chk('切换后:令牌声明 = YJ_TEST(下个请求就查测试库)', now.claim === 'YJ_TEST', now.claim)
    chk('切换后:顶栏名字 = 测试库', now.name === 'YINJIA-MES·测试库', now.name)
    chk('切换后:mes_user.factory 同步为 YJ_TEST', now.userFactory === 'YJ_TEST', now.userFactory)
    chk('切换后:桌面欢迎条显示的也是测试库(不再骗人)', String(now.dashText).includes('测试库'), now.dashText.slice(0, 40))
    await shot('factory-switch-done')

    // ⑤ 再切回正式账套,确认可逆
    await openMenu()
    await evaluate(`(() => { const it = [...document.querySelectorAll('.el-dropdown-menu__item .factory-item')].find(e => e.innerText.trim() === 'YINJIA-MES'); if (it) it.closest('li').click(); return 'ok' })()`)
    await sleep(1200)
    await evaluate(`(() => { const i = document.querySelector('.factory-switch-dialog input'); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(i,'123456'); i.dispatchEvent(new Event('input',{bubbles:true})); return 'ok' })()`)
    await sleep(300)
    await evaluate(`(() => { const b = [...document.querySelectorAll('.factory-switch-dialog .el-dialog__footer button')].find(x => x.innerText.includes('切换')); b.click(); return 'ok' })()`)
    await sleep(9000)
    const back = await evaluate(`(() => { const t = localStorage.getItem('mes_token'); return { claim: JSON.parse(atob(t.split('.')[1])).factory, name: (document.querySelector('.factory .factory-name') || {}).innerText } })()`)
    chk('切回正式账套成功(可逆)', back.claim === 'YJ' && back.name === 'YINJIA-MES', back)
  } finally {
    edge.kill()
  }
  console.log(fails ? '\n结果:' + fails + ' 项未通过' : '\n结果:全部通过')
  process.exit(fails ? 1 : 0)
}

main().catch((e) => { console.error('FAIL: ' + (e && e.message)); process.exit(1) })
