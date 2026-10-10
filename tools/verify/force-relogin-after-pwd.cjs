/* 验证「改密后强制重新登录」：
 * 1) 用 admin 登录，写入 localStorage(mes_token/mes_user) 模拟已登录会话
 * 2) 进 #/dashboard，确认顶栏在（已登录状态）
 * 3) 走真实 UI：用户菜单 → 修改密码 → 填旧/新/确认 → 点确定
 * 4) 断言：localStorage 的 mes_token / mes_user 被清空，路由变为 #/login
 * 5) 用新密码改回原密码，避免污染账号
 * 用法: node tools/verify/force-relogin-after-pwd.cjs
 *
 * 排错记录（改前先读，省一轮）：
 * - Runtime.evaluate 的表达式不能含换行，必须压成一行。
 * - 页面停在 about:blank 时 localStorage 抛 SecurityError；必须先 navigate 到
 *   http://localhost:5173 再注入。
 * - Pinia store 在启动时读 localStorage（frontend/src/stores/user.js:8-21），
 *   所以注入必须发生在应用 bootstrap 之前：先开 /#/login，注入，再跳到 /#/dashboard。
 * - frontend/src/router/index.js:63-67 会把「无 DASHBOARD 权限」的非管理员从
 *   /dashboard 踢走，所以本探针用 admin（isAdmin=true 跳过该分支）。
 */
const { spawn } = require('node:child_process')
const { mkdtempSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const WebSocket = require('ws')

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9366
const BASE = 'http://127.0.0.1:8090'
const WEB = 'http://localhost:5173'
const USER = 'admin'
const OLD = '123456'
const NEW = 'YjAdmin@2026'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function login(userName, password) {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, password }),
  })
  return { http: r.status, body: await r.json().catch(() => null) }
}

function cdp(ws) {
  let id = 0
  const pend = new Map()
  ws.on('message', (raw) => {
    const m = JSON.parse(raw)
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
  })
  return (method, params) => new Promise((res, rej) => {
    const myId = ++id
    pend.set(myId, (m) => (m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result)))
    ws.send(JSON.stringify({ id: myId, method, params: params || {} }))
  })
}

async function evaluate(send, expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) {
    const d = r.exceptionDetails
    throw new Error(expr.slice(0, 80) + ' -> ' + (d.text || '') + ' | ' + (d.exception && (d.exception.description || d.exception.value) || ''))
  }
  return r.result.value
}

/* 真实鼠标点击（element.click() 不触发 EP popper / 上下文菜单） */
async function clickAt(send, x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
}

async function clickSel(send, sel) {
  const box = await evaluate(send, `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`)
  if (!box) {
    const dump = await evaluate(send, `(() => ({ hash: location.hash, title: document.title, bodyLen: (document.body.innerText || '').length, head: (document.body.innerText || '').slice(0, 300), classes: [...document.querySelectorAll('div,span,a')].slice(0, 60).map(e => e.className).filter(c => typeof c === 'string' && c).slice(0, 25) }))()`)
    throw new Error('未找到元素: ' + sel + ' | ' + JSON.stringify(dump))
  }
  await clickAt(send, box.x, box.y)
  return box
}

async function waitFor(send, expr, label, timeout = 8000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (await evaluate(send, expr)) return true
    await sleep(150)
  }
  throw new Error('等待超时: ' + label)
}

async function main() {
  const out = {}
  const lg = await login(USER, OLD)
  out.step1_login = { http: lg.http, code: lg.body?.code }
  const token = lg.body?.data?.token
  const userObj = lg.body?.data?.user
  if (!token) { console.log(JSON.stringify(out, null, 1)); throw new Error('登录失败，无法继续') }

  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1280,900',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'edge-pwd-'))}`, 'about:blank'],
    { stdio: 'ignore' })
  try {
    await sleep(2500)
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl, { perMessageDeflate: false })
    await new Promise((r) => ws.on('open', r))
    const send = cdp(ws)
    await send('Page.enable'); await send('Runtime.enable')

    // 必须先导航到真实 origin：about:blank 下 localStorage 被拒（SecurityError）
    await send('Page.navigate', { url: WEB + '/#/login' })
    await sleep(3000)

    // 免登录：预置会话（必须在应用 bootstrap 前写入，Pinia 只在启动时读一次）
    await evaluate(send, `localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(userObj))}); localStorage.setItem('mes_dark', '0'); 1`)
    out.step2a_seeded = await evaluate(send, `({ t: !!localStorage.getItem('mes_token'), u: !!localStorage.getItem('mes_user') })`)
    // 用整页刷新（而非 hash 变化）让应用重新 bootstrap，重新读取 localStorage
    await send('Page.navigate', { url: WEB + '/#/dashboard' })
    await send('Page.reload', { ignoreCache: false })
    await sleep(4000)
    out.step2_loggedIn = {
      hash: await evaluate(send, 'location.hash'),
      tokenPresent: await evaluate(send, `!!localStorage.getItem('mes_token')`),
    }

    // 打开用户菜单（顶栏右侧）
    await clickSel(send, '.topbar .user, .show-name, .user-img')
    await sleep(600)
    await waitFor(send, `!!document.querySelector('.t-dropdown-popper .el-dropdown-menu__item')`, '用户下拉展开')

    // 点「修改密码」
    const hit = await evaluate(send, `(() => { const items = [...document.querySelectorAll('.t-dropdown-popper .el-dropdown-menu__item')]; const el = items.find(i => (i.textContent || '').includes('修改密码')); if (!el) return { found: false, all: items.map(i => (i.textContent || '').trim()) }; const r = el.getBoundingClientRect(); return { found: true, x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`)
    out.step3_menuItems = hit.found ? 'found 修改密码' : { missing: true, all: hit.all }
    if (!hit.found) throw new Error('用户菜单里没有「修改密码」项')
    await clickAt(send, hit.x, hit.y)
    await sleep(700)

    // 填三个输入框（用原生 setter 触发 Vue 的 v-model）
    const filled = await evaluate(send, `(() => { const dlg = [...document.querySelectorAll('.el-dialog')].find(d => d.offsetParent !== null); if (!dlg) return { ok: false, why: 'no visible dialog' }; const inputs = [...dlg.querySelectorAll('input')]; if (inputs.length < 3) return { ok: false, why: 'inputs=' + inputs.length }; const setVal = (el, v) => { const proto = Object.getPrototypeOf(el); Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }; setVal(inputs[0], ${JSON.stringify(OLD)}); setVal(inputs[1], ${JSON.stringify(NEW)}); setVal(inputs[2], ${JSON.stringify(NEW)}); const btns = [...dlg.querySelectorAll('.el-dialog__footer button')]; const okBtn = btns.find(b => (b.textContent || '').includes('确定')); if (!okBtn) return { ok: false, why: 'no 确定 button' }; const r = okBtn.getBoundingClientRect(); return { ok: true, x: r.x + r.width / 2, y: r.y + r.height / 2, values: inputs.map(i => i.value) }; })()`)
    out.step4_formFilled = filled
    if (!filled.ok) throw new Error('填表失败: ' + JSON.stringify(filled))
    await clickAt(send, filled.x, filled.y)

    // 断言：会话被清 + 跳到登录页
    await waitFor(send, `location.hash.includes('/login')`, '跳转登录页', 10000)
    out.step5_afterChange = {
      hash: await evaluate(send, 'location.hash'),
      tokenPresent: await evaluate(send, `!!localStorage.getItem('mes_token')`),
      userPresent: await evaluate(send, `!!localStorage.getItem('mes_user')`),
    }

    // 新密码仍可用（后端真的写进去了）—— 并改回原密码
    const lgNew = await login(USER, NEW)
    out.step6_loginWithNewPwd = { http: lgNew.http, code: lgNew.body?.code }
    const t2 = lgNew.body?.data?.token
    if (t2) {
      const back = await fetch(BASE + '/api/auth/changePassword', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t2 },
        body: JSON.stringify({ old: NEW, next: OLD }),
      })
      out.step7_restore = { http: back.status }
      const lgBack = await login(USER, OLD)
      out.step8_oldPwdWorksAgain = { http: lgBack.http, code: lgBack.body?.code }
    }
    ws.close()
  } finally {
    proc.kill()
  }
  console.log(JSON.stringify(out, null, 1))
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
