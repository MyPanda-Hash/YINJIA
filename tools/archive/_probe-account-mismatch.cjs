/**
 * 临时探针(2026-09-22):两个账套账号/权限不一致时的行为
 *   A 账号只在测试库存在 → 切正式:干净失败(报错/留原地/令牌不变/不登出)
 *   B 访问本账套无权限的面板 → 服务端挡(403 走 body-code,不触发登出)
 *   C 同一账号在两个账套权限不同(正式=管理员全权,测试=仓管角色窄集):
 *     在正式库停在"测试库无权限"的面板上切换到测试库,看重载后会发生什么
 * 说明:场景 C 需要外部先把测试库的 admin 降级(is_admin='N', role_id=2),跑完再恢复 ——
 *       见调用方的夹具脚本,不在本探针里改库。
 * 用法: node --experimental-websocket tools/archive/_probe-account-mismatch.cjs [FRONT] [USER] [PWD]
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const FRONT = process.argv[2] || 'http://localhost:5173'
const USER = process.argv[3] || 'switchprobe'
const PWD = process.argv[4] || '123456'
const NO_PERM_PANEL = 'BOM'        // 测试库 role 2 看不到、正式库 admin 看得到
const TEST_ONLY_USER = 'switchprobe'
const API = 'http://localhost:8090/api'
const PORT = 9375
const OUT = path.join(process.env.TEMP, 'dash-audit')
const CANDS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
]
const EDGE = CANDS.find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const chk = (n, ok, ex) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + n + (ex === undefined ? '' : '  → ' + JSON.stringify(ex))); if (!ok) fails++ }
const note = (n, ex) => console.log('  INFO  ' + n + (ex === undefined ? '' : '  → ' + JSON.stringify(ex)))

async function apiLogin(userName, password, factory) {
  const r = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName, password, factory }),
  })
  let body = null
  try { body = await r.json() } catch { /* ignore */ }
  return { status: r.status, body }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })

  console.log('\n【场景 A-0】接口层:' + TEST_ONLY_USER + ' 的跨账套存在性')
  const toProd = await apiLogin(TEST_ONLY_USER, PWD, 'YJ')
  chk('正式账套登录被拒(该账号不在正式库)', toProd.status === 409, { status: toProd.status, msg: toProd.body && toProd.body.message })
  const toTest = await apiLogin(TEST_ONLY_USER, PWD, 'YJ_TEST')
  chk('测试账套登录成功(确为"仅测试库账号")', toTest.status === 200 && !!toTest.body.data.token, toTest.status)
  const tUser = toTest.body.data.user
  chk('场景 B 用的 ' + NO_PERM_PANEL + ' 确实不在其可见面板里', !(tUser.visiblePanels || []).includes(NO_PERM_PANEL), (tUser.visiblePanels || []).length + ' 个可见')

  console.log('\n【场景 C-0】接口层:同一账号 admin 在两个账套的权限差异')
  const adminProd = await apiLogin('admin', PWD, 'YJ')
  const adminTest = await apiLogin('admin', PWD, 'YJ_TEST')
  chk('admin 两个账套都能登(账号同名)', adminProd.status === 200 && adminTest.status === 200, { prod: adminProd.status, test: adminTest.status })
  const pU = adminProd.body.data.user, tU = adminTest.body.data.user
  note('正式库 admin: isAdmin=' + pU.isAdmin + ', visiblePanels=' + JSON.stringify(pU.visiblePanels).slice(0, 20))
  note('测试库 admin: isAdmin=' + tU.isAdmin + ', 可见面板数=' + (tU.visiblePanels || []).length)
  const fixActive = tU.isAdmin === false
  if (!fixActive) console.log('  ⚠ 夹具未生效(测试库 admin 仍是管理员)—— 场景 C 会退化,请先跑夹具降级脚本')

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'acct-mismatch-'))
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
    const seed = async (login, factoryName) => {
      await send('Page.navigate', { url: `${FRONT}/#/login` }); await sleep(1600)
      await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.body.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.body.data.user))});
localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: login.body.data.user.factory, name: factoryName }))});
localStorage.setItem('mes_desk_settings', JSON.stringify({ quick: ['newOrder', 'rdApply', 'rdProduct'], showKpi: true, showProgress: true, showTodo: true, v: 2 }));
localStorage.setItem('mes_login_date','2026-09-22'); 'ok'`)
    }
    const openAndGo = async (hashPath) => {
      await send('Page.navigate', { url: 'about:blank' }); await sleep(350)
      await send('Page.navigate', { url: `${FRONT}/#${hashPath}` }); await sleep(4200)
      await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 'x' })()`)
      await sleep(900)
    }
    const clickDialogButton = async (label) => evaluate(`(() => {
      const btns = [...document.querySelectorAll('.factory-switch-dialog .el-dialog__footer button')]
      const norm = (s) => s.replace(/\\s+/g, '')
      const b = btns.find(x => norm(x.innerText).includes(${JSON.stringify(label)}))
      if (!b) return 'NOT-FOUND:' + btns.map(x => x.innerText).join('|')
      b.click(); return 'clicked'
    })()`)
    const fillPassword = async (pwd) => {
      await evaluate(`(() => { const i = document.querySelector('.factory-switch-dialog input'); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(i, ${JSON.stringify(pwd)}); i.dispatchEvent(new Event('input',{bubbles:true})); return 'ok' })()`)
      await sleep(300)
    }
    const openSwitcher = async (targetName) => {
      await evaluate(`(() => { const f = document.querySelector('.factory'); f.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true})); return 'ok' })()`)
      await sleep(800)
      return evaluate(`(() => { const it = [...document.querySelectorAll('.el-dropdown-menu__item .factory-item')].find(e => e.innerText.trim() === ${JSON.stringify(targetName)}); if (!it) return 'NO-ITEM'; it.closest('li').click(); return 'clicked' })()`)
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

    console.log('\n【场景 A】仅测试库账号,在测试库会话里尝试切正式账套')
    await seed(toTest, 'YINJIA-MES·测试库')
    await openAndGo('/dashboard')
    const a0 = await evaluate(`(() => { const t = localStorage.getItem('mes_token'); return { hash: location.hash, name: (document.querySelector('.factory .factory-name')||{}).innerText, claim: JSON.parse(atob(t.split('.')[1])).factory } })()`)
    chk('会话就绪(测试账套)', a0.name === 'YINJIA-MES·测试库' && a0.claim === 'YJ_TEST', a0)
    await openSwitcher('YINJIA-MES')
    await sleep(1200)
    chk('弹出切换确认框', await evaluate(`!!document.querySelector('.factory-switch-dialog')`) === true)
    await fillPassword(PWD)
    chk('点了确认', await clickDialogButton('切换') === 'clicked')
    await sleep(3500)
    const a1 = await evaluate(`(() => {
      const t = localStorage.getItem('mes_token') || ''
      const d = document.querySelector('.factory-switch-dialog')
      return { loggedIn: !!t && t.length > 20, claim: t ? JSON.parse(atob(t.split('.')[1])).factory : null,
               hash: location.hash, err: d ? (d.querySelector('.fs-error') || {}).innerText : 'DIALOG-CLOSED',
               topName: (document.querySelector('.factory .factory-name')||{}).innerText }
    })()`)
    chk('失败后未被登出', a1.loggedIn === true)
    chk('令牌声明未被改写(仍 YJ_TEST)', a1.claim === 'YJ_TEST', a1.claim)
    chk('没被踢到登录页', !a1.hash.includes('/login'), a1.hash)
    chk('顶栏账套名未变', a1.topName === 'YINJIA-MES·测试库', a1.topName)
    chk('弹窗给出原因', typeof a1.err === 'string' && a1.err !== 'DIALOG-CLOSED' && a1.err.length > 0, a1.err)
    await shot('acct-mismatch-switch-failed')
    chk('取消按钮能关掉弹窗(不卡死)', await clickDialogButton('取消') === 'clicked')
    await sleep(1000)
    chk('取消后弹窗不可见', await evaluate(`(() => { const d = document.querySelector('.factory-switch-dialog'); return !d || d.offsetParent === null || getComputedStyle(d).display === 'none' })()`) === true)

    console.log('\n【场景 B】访问本账套无权限的面板 ' + NO_PERM_PANEL)
    await openAndGo(`/panelx/list/${NO_PERM_PANEL}`)
    const b = await evaluate(`(() => { const t = localStorage.getItem('mes_token')||''; const txt = (document.body.innerText||'').replace(/\\s+/g,' '); return { hash: location.hash, loggedIn: !!t && t.length>20, rows: document.querySelectorAll('.el-table__row').length, denied: /无该面板|无权限|没有权限/.test(txt), msg: !!document.querySelector('.el-message--error, .el-message-box, .el-notification'), text: txt.slice(0,200) } })()`)
    chk('仍在登录态(403 走 body-code 不触发登出)', b.loggedIn === true)
    chk('没被踢到登录页', !b.hash.includes('/login'), b.hash)
    chk('页面有可见反馈(非白屏)', b.text.length > 20, b.text.slice(0, 100))
    chk('无权限面板不渲染任何数据行', b.rows === 0, b.rows)
    note('是否出现权限提示文案', { denied: b.denied, msg: b.msg })
    await shot('acct-mismatch-no-perm-panel')

    console.log('\n【场景 C】正式库(全权)停在测试库无权限的面板上 → 切到测试库(窄权限)')
    await seed(adminProd, 'YINJIA-MES')
    await openAndGo(`/panelx/list/${NO_PERM_PANEL}`)
    const c0 = await evaluate(`(() => { const t = localStorage.getItem('mes_token'); return { hash: location.hash, claim: JSON.parse(atob(t.split('.')[1])).factory, text: (document.body.innerText||'').replace(/\\s+/g,' ').slice(0,80) } })()`)
    chk('正式库 admin 能打开 ' + NO_PERM_PANEL + ' 面板', c0.claim === 'YJ' && c0.hash.includes(NO_PERM_PANEL), c0.hash)
    note('切前的页面片段', c0.text)
    await openSwitcher('YINJIA-MES·测试库')
    await sleep(1200)
    await fillPassword(PWD)
    chk('点了确认', await clickDialogButton('切换') === 'clicked')
    console.log('  等待整页刷新…')
    await sleep(9000)
    await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 'x' })()`)
    await sleep(1200)
    const c1 = await evaluate(`(() => {
      const t = localStorage.getItem('mes_token') || ''
      const u = JSON.parse(localStorage.getItem('mes_user') || '{}')
      return { loggedIn: !!t && t.length>20, claim: t ? JSON.parse(atob(t.split('.')[1])).factory : null,
               hash: location.hash, isAdmin: u.isAdmin, panels: (u.visiblePanels||[]).length,
               text: (document.body.innerText||'').replace(/\\s+/g,' ').slice(0, 220),
               hasTable: !!document.querySelector('.el-table'), rows: document.querySelectorAll('.el-table__row').length,
               msg: !!document.querySelector('.el-message--error, .el-message-box, .el-notification') }
    })()`)
    chk('切换成功(令牌声明=YJ_TEST)', c1.claim === 'YJ_TEST', c1.claim)
    chk('切换后权限已按测试库口径(isAdmin=false)', c1.isAdmin === false, c1.isAdmin)
    chk('切换后仍处于登录态', c1.loggedIn === true)
    chk('**没有泄漏正式库数据**:无权限面板不渲染数据行', c1.rows === 0, { rows: c1.rows, hasTable: c1.hasTable })
    chk('切换后**不再停在目标账套无权限的面板**上', !c1.hash.includes(NO_PERM_PANEL), c1.hash)
    chk('页面有可见反馈(非白屏)', c1.text.length > 20, c1.text.slice(0, 120))
    note('切换后落地路由', c1.hash)
    note('切换后页面片段', c1.text.slice(0, 160))
    await shot('acct-mismatch-after-switch-restricted')
  } finally {
    edge.kill()
  }
  console.log(fails ? '\n结果:' + fails + ' 项未通过' : '\n结果:全部通过')
  process.exit(fails ? 1 : 0)
}
main().catch((e) => { console.error('FAIL: ' + (e && e.message)); process.exit(1) })
