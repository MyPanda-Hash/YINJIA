/**
 * OrgAdmin 渲染崩溃复现探针
 *
 * 目的:用户报告「这个页面点检查时页面渲染崩溃」。本探针进 /sys/org,
 *      监听 Runtime.exceptionThrown / Log.entryAdded / Runtime.consoleAPICalled,
 *      点角色行让权限矩阵渲染,再把捕获到的异常原样打印出来。
 *
 * 用法: node tools/verify/orgadmin-crash.cjs [--port=9401]
 * 退出: 0=无异常 1=捕获到异常 2=流程失败
 */
const { connect } = require('./lib/mini-ws.cjs')
const { spawn } = require('child_process')
const http = require('http')
const path = require('path')
const fs = require('fs')

const PORT = (process.argv.find((a) => a.startsWith('--port=')) || '--port=9401').split('=')[1]
const VITE = 'http://localhost:5173'
const API = 'http://127.0.0.1:8090'
const SHOT = path.join(__dirname, '_orgadmin-crash.png')

const log = (...a) => console.log('[probe]', ...a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function findEdge() {
  const cands = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ]
  for (const c of cands) if (fs.existsSync(c)) return c
  throw new Error('msedge.exe not found')
}

function httpJson(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: pathname, timeout: 15000 }, (res) => {
      let b = ''
      res.on('data', (d) => (b += d))
      res.on('end', () => {
        try { resolve(JSON.parse(b)) } catch (e) { reject(new Error('bad json: ' + b.slice(0, 200))) }
      })
    })
    req.on('timeout', () => { req.destroy(new Error('http timeout ' + pathname)) })
    req.on('error', reject)
  })
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = [] }
  static async attach(wsUrl) {
    const ws = await connect(wsUrl)
    const c = new CDP(ws)
    ws.on('message', (raw) => {
      let m
      try { m = JSON.parse(raw) } catch { return }
      if (m.id && c.pending.has(m.id)) {
        const { res, rej } = c.pending.get(m.id)
        c.pending.delete(m.id)
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)
      } else if (m.method) {
        for (const h of c.handlers) h(m)
      }
    })
    return c
  }
  on(fn) { this.handlers.push(fn) }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  /** 表达式求值;表达式内禁止换行 */
  async ev(expr) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true,
    })
    if (r.exceptionDetails) {
      const d = r.exceptionDetails.exception && r.exceptionDetails.exception.description
      throw new Error('EVAL: ' + (d || r.exceptionDetails.text))
    }
    return r.result.value
  }
}

;(async () => {
  let ok = true
  const exceptions = []
  const logs = []
  const profile = path.join(process.env.TEMP, '_mes_crash_profile_' + PORT)

  log('launch headless edge on :' + PORT)
  const edge = spawn(findEdge(), [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile,
    '--window-size=1440,900', 'about:blank',
  ], { detached: true, stdio: 'ignore' })
  edge.unref()

  // 等 devtools 端口就绪
  let targets = null
  for (let i = 0; i < 25; i++) {
    await sleep(800)
    try { targets = await httpJson('/json/list'); if (targets.some((t) => t.type === 'page')) break } catch {}
  }
  if (!targets) { log('FAIL: devtools 端口未就绪'); process.exit(2) }
  let page = targets.find((t) => t.type === 'page')
  if (!page) { log('FAIL: 无 page target'); process.exit(2) }

  const c = await CDP.attach(page.webSocketDebuggerUrl)
  c.on((m) => {
    if (m.method === 'Runtime.exceptionThrown') {
      const e = m.params.exceptionDetails
      const desc = (e.exception && e.exception.description) || e.text
      exceptions.push({ at: new Date().toISOString(), desc, url: e.url, line: e.lineNumber })
      log('!!! EXCEPTION:', desc.split('\n').slice(0, 6).join(' | '))
    }
    if (m.method === 'Log.entryAdded') {
      const e = m.params.entry
      if (e.level === 'error' || e.level === 'warning') {
        logs.push({ level: e.level, text: e.text, url: e.url })
        log('LOG', e.level + ':', String(e.text).slice(0, 220))
      }
    }
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
      const txt = (m.params.args || []).map((a) => a.value || a.description || a.type).join(' ')
      logs.push({ level: 'console.' + m.params.type, text: txt })
      log('CONSOLE', m.params.type + ':', txt.slice(0, 220))
    }
  })
  await c.send('Runtime.enable')
  await c.send('Log.enable')
  await c.send('Page.enable')

  // 登录拿 token
  const login = await fetch(API + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json())
  if (login.code !== 200) { log('FAIL 登录:', JSON.stringify(login)); process.exit(2) }
  const token = login.data.token || login.data.accessToken
  const user = login.data.user || login.data.userInfo || {}
  log('login ok, token len', String(token).length)

  // 先到真实 origin 才能写 localStorage
  await c.send('Page.navigate', { url: VITE + '/#/login' })
  await sleep(4000)

  log('inject session')
  const me = JSON.stringify(user)
  await c.ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(me)}); 'ok'`)
  log('mes_user =', me)

  log('goto /sys/org')
  await c.send('Page.navigate', { url: VITE + '/#/sys/org' })
  await sleep(9000)

  let route = await c.ev('location.hash')
  if (!String(route).includes('/sys/org')) {
    log('first nav landed on', route, '-> hard reload')
    await c.send('Page.navigate', { url: VITE + '/#/sys/org' })
    await sleep(2000)
    await c.send('Page.reload', {})
    await sleep(9000)
    route = await c.ev('location.hash')
  }
  if (!String(route).includes('/sys/org')) {
    // 再兜底:等 store 就绪后手动改 hash,并读出 router 解析结果
    log('still on', route, '-> force hash, inspect router state')
    const diag = await c.ev(`(function(){
      try {
        var app = document.querySelector('#app');
        var piniaState = null;
        var s = app && app.__vue_app__ && app.__vue_app__.config.globalProperties.$pinia;
        if (s) { var st = s.state.value; piniaState = { hasToken: !!(st.user && st.user.token), isAdmin: !!(st.user && st.user.isAdmin), roleCode: st.user && st.user.roleCode }; }
        return JSON.stringify({pinia: piniaState, hash: location.hash});
      } catch(e) { return JSON.stringify({err: String(e)}); }
    })()`)
    log('diag:', diag)
    await c.ev(`location.hash = '#/sys/org'; 'set'`)
    await sleep(5000)
    route = await c.ev('location.hash')
  }
  log('hash =', route)
  if (!String(route).includes('/sys/org')) {
    const dbg = await c.ev(`JSON.stringify({token: !!localStorage.getItem('mes_token'), user: (localStorage.getItem('mes_user')||'').slice(0,80)})`)
    log('FAIL: 未停在 /sys/org; localStorage =', dbg)
    process.exit(2)
  }

  // 关掉可能的弹窗,避免污染
  await c.ev(`(function(){var b=document.querySelector('.el-dialog__headerbtn'); if(b) b.click(); return 'closed';})()`)
  await sleep(1500)

  // 点角色表的行(右侧面板),触发权限矩阵渲染。
  // 页面有三张 el-table:部门树/用户/角色;角色表的特点是行内含「角色名称」列头且含『编码』。
  const clicked = await c.ev(`(function(){
    var tables = document.querySelectorAll('.el-table');
    for (var ti=0; ti<tables.length; ti++){
      var head = (tables[ti].querySelector('.el-table__header') || {}).innerText || '';
      if (head.indexOf('角色名称') < 0) continue;
      var rows = tables[ti].querySelectorAll('.el-table__body-wrapper tbody tr');
      for (var i=0;i<rows.length;i++){
        var t = (rows[i].innerText||'').replace(/\\s+/g,' ').trim();
        if (t.indexOf('管理员') === 0 && t.indexOf('admin') > 0) continue;
        var cell = rows[i].querySelectorAll('td')[0];
        (cell || rows[i]).click();
        return 'table#' + ti + ' :: ' + t.slice(0, 70);
      }
    }
    return '';
  })()`)
  log('clicked role row:', clicked || '(none)')
  await sleep(6000)

  const state = await c.ev(`(function(){
    var g = document.querySelectorAll('.perm-collapse .el-collapse-item').length;
    var t = document.querySelectorAll('.perm-table').length;
    var tr = document.querySelectorAll('.perm-table tbody tr').length;
    var tip = document.querySelector('.admin-tip');
    return JSON.stringify({collapseItems:g, tables:t, rows:tr, adminTip: !!tip});
  })()`)
  log('matrix state:', state)

  // 截图留证
  try {
    const shot = await c.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(SHOT, Buffer.from(shot.data, 'base64'))
    log('shot ->', SHOT)
  } catch (e) { log('shot failed:', e.message) }

  console.log('\n=========== 捕获到的异常 ===========')
  if (exceptions.length === 0) console.log('(无) 该路径未触发运行时异常')
  else exceptions.forEach((e, i) => console.log(`#${i + 1} ${e.desc}\n   at ${e.url}:${e.line}`))

  console.log('\n=========== 错误级日志 ===========')
  const errs = logs.filter((l) => !/DevTools|Download the Vue Devtools|favicon/i.test(l.text))
  if (errs.length === 0) console.log('(无)')
  else errs.forEach((l) => console.log(`[${l.level}] ${String(l.text).slice(0, 400)}`))

  if (exceptions.length) ok = false
  try { edge.kill() } catch {}
  process.exit(ok ? 0 : 1)
})().catch((e) => { console.error('PROBE FAIL:', e.message); process.exit(2) })
