/**
 * 探针:组织架构「编辑用户 → 重置密码」端到端(测试账套 YJ_TEST)
 * 走真实界面操作,再回 API 验证新口令真的生效;结束前把口令还原。
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const BASE = 'http://127.0.0.1:8090'
const API = BASE + '/api'
const FACTORY = 'YJ_TEST'
const TARGET = 'cp'
const NEWPW = 'Cx123456'
const OLDPW = '123456'
const PORT = 9361
const OUT = path.join(process.env.TEMP, 'mes-org-pw')
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let fails = 0
const chk = (id, name, ok, detail) => {
  console.log(`  ${ok ? '\u2713' : '\u2717'} [${id}] ${name}${detail === undefined ? '' : '  → ' + detail}`)
  if (!ok) fails++
}

async function login(u, p) {
  const r = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: u, password: p, factory: FACTORY }),
  })
  const j = await r.json().catch(() => ({}))
  return j?.data?.token || null
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const adminTok = await login('admin', '123456')
  if (!adminTok) throw new Error('admin 登录失败')

  // 记下目标账号原始资料(node 处理 UTF-8 正确,不用 PowerShell)
  const list = await (await fetch(API + '/sys/user/list', { headers: { Authorization: 'Bearer ' + adminTok } })).json()
  const cp = list.data.find((u) => u.userName === TARGET)
  if (!cp) throw new Error('找不到账号 ' + TARGET)
  console.log(`[前置] 目标 ${cp.userName} / ${cp.realName}  id=${cp.id}  当前 ${OLDPW} 能登录: ${!!(await login(TARGET, OLDPW))}`)

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'org-pw-'))
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' })
  let uiSaved = false
  try {
    let target = null
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(300)
      try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page') } catch {}
    }
    if (!target) throw new Error('CDP 未就绪')
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let id = 0
    const pend = new Map()
    const errs = []
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push((m.params.args || []).map((a) => a.value || a.description).join(' ').slice(0, 160))
    }
    const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
    const ev = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
      if (r.result && r.result.exceptionDetails) return '[JS异常] ' + r.result.exceptionDetails.text
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const shot = async (n) => {
      const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
      fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from(s.result.data, 'base64'))
      console.log('  shot → ' + path.join(OUT, n + '.png'))
    }
    const user = (await (await fetch(API + '/auth/me', { headers: { Authorization: 'Bearer ' + adminTok } })).json().catch(() => ({})))?.data
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2000)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(adminTok)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user || { userName: 'admin', realName: '系统管理员', isAdmin: 'Y', factory: FACTORY }))});
localStorage.setItem('mes_login_date','2026-10-15'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
    await send('Page.navigate', { url: BASE + '/#/sys/org' }); await sleep(5000)

    // 找 cp 那一行并点开(表格 @row-click="openUser")
    const clicked = await ev(`(() => {
      const rows = [...document.querySelectorAll('.el-table__row')]
      const r = rows.find(x => [...x.querySelectorAll('td')].some(td => td.innerText.trim() === ${JSON.stringify(TARGET)}))
      if (!r) return 'row-not-found:' + rows.length
      r.click(); return 'clicked'
    })()`)
    chk('U1', '在用户表里点开 ' + TARGET + ' 的编辑', clicked === 'clicked', clicked)
    await sleep(1500)

    const dlg = `(() => {
      const d = [...document.querySelectorAll('.el-dialog')].find(x => x.offsetParent !== null && /用户/.test((x.querySelector('.el-dialog__title')||{}).innerText||''))
      return d || null
    })()`
    const labels = await ev(`(() => { const d = ${dlg}; if(!d) return []; return [...d.querySelectorAll('.el-form-item__label')].map(e=>e.innerText.trim()) })()`)
    chk('U2', '编辑弹窗里出现了「重置密码」开关', Array.isArray(labels) && labels.includes('重置密码'), JSON.stringify(labels))
    const beforeVisible = await ev(`(() => { const d = ${dlg}; if(!d) return null;
      const it = [...d.querySelectorAll('.el-form-item')].find(x => ((x.querySelector('.el-form-item__label')||{}).innerText||'').trim() === '新密码')
      return it ? (it.offsetParent !== null) : false })()`)
    chk('U3', '开关默认关 → 新密码输入框不显示(不会误改口令)', beforeVisible === false, 'visible=' + beforeVisible)
    await shot('01-edit-user-switch-off')

    const toggled = await ev(`(() => { const d = ${dlg}; if(!d) return 'no-dialog';
      const it = [...d.querySelectorAll('.el-form-item')].find(x => ((x.querySelector('.el-form-item__label')||{}).innerText||'').trim() === '重置密码')
      if(!it) return 'no-switch'; const sw = it.querySelector('.el-switch'); if(!sw) return 'no-el-switch';
      sw.click(); return 'ok' })()`)
    chk('U4', '打开「重置密码」开关', toggled === 'ok', toggled)
    await sleep(900)
    const afterVisible = await ev(`(() => { const d = ${dlg}; if(!d) return null;
      const it = [...d.querySelectorAll('.el-form-item')].find(x => ((x.querySelector('.el-form-item__label')||{}).innerText||'').trim() === '新密码')
      return it ? (it.offsetParent !== null) : false })()`)
    chk('U5', '开关打开 → 新密码输入框出现', afterVisible === true, 'visible=' + afterVisible)

    const typed = await ev(`(() => { const d = ${dlg}; if(!d) return 'no-dialog';
      const it = [...d.querySelectorAll('.el-form-item')].find(x => ((x.querySelector('.el-form-item__label')||{}).innerText||'').trim() === '新密码')
      const inp = it && it.querySelector('input'); if(!inp) return 'no-input';
      inp.value = ${JSON.stringify(NEWPW)};
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      return 'typed' })()`)
    chk('U6', '填入新密码(≥6 位)', typed === 'typed', typed)
    await sleep(600)
    await shot('02-edit-user-reset-on')

    const saved = await ev(`(() => { const d = ${dlg}; if(!d) return 'no-dialog';
      const btns = [...d.querySelectorAll('.el-dialog__footer button')]
      const b = btns.find(x => /保存/.test(x.innerText)); if(!b) return 'no-save-btn';
      b.click(); return 'clicked' })()`)
    chk('U7', '点「保存」', saved === 'clicked', saved)
    await sleep(2500)
    uiSaved = true
    await shot('03-after-save')
    console.log('  [console 报错] ' + (errs.length ? JSON.stringify(errs) : '无'))
    ws.close()
  } finally {
    edge.kill()
  }

  // ── API 侧验证:新口令生效、旧口令失效 ──
  if (uiSaved) {
    chk('A1', '界面保存后,新口令能登录', !!(await login(TARGET, NEWPW)))
    chk('A2', '旧口令已失效', !(await login(TARGET, OLDPW)))
    const u2 = (await (await fetch(API + '/sys/user/list', { headers: { Authorization: 'Bearer ' + adminTok } })).json()).data.find((u) => u.userName === TARGET)
    chk('A3', '账号资料未被清空(姓名/角色/启用)', u2.realName === cp.realName && u2.roleId === cp.roleId && u2.enabled === cp.enabled,
      `realName=${u2.realName} roleId=${u2.roleId} enabled=${u2.enabled}`)
    // 还原
    const r = await fetch(API + '/sys/user/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + adminTok },
      body: JSON.stringify({ id: cp.id, userName: cp.userName, realName: cp.realName, deptId: cp.deptId, roleId: cp.roleId, workshop: cp.workshop, enabled: cp.enabled, password: OLDPW }),
    })
    chk('A4', '已还原为原口令', r.status === 200 && !!(await login(TARGET, OLDPW)))
  }
  console.log('')
  if (fails === 0) console.log('[PASS] 组织架构「编辑用户 → 重置密码」链路正常')
  else { console.log(`[FAIL] ${fails} 项不符`); process.exit(1) }
}
main().catch((e) => { console.error('FATAL ' + e.message); process.exit(1) })
