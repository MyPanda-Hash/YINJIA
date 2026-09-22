/**
 * _probe-org-user-del-ui.cjs — 组织架构「删除账号」界面验收(真实服务 + 真实弹窗)
 *
 * 在 8090 上真跑一遍:登录 → 组织架构 → 找到可删行 → 点删除 → 看确认弹窗 →
 * 中文态断言 → 切英文再断言(AGENTS.md 判定标准:切语言后新功能显示目标语言) →
 * 点取消(不删) → 再点删除并确认 → 行消失 + 成功提示 → API 复核 + 截图。
 *
 * ⚠ 会创建一个临时账号 zz_probe_uidel 并在界面里删掉它;结束时兜底清理。
 * 用法:node --experimental-websocket tools/archive/_probe-org-user-del-ui.cjs
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const FRONT = 'http://127.0.0.1:8090'      // 直接用后端托管的构建产物(就是部署路径)
const API = 'http://127.0.0.1:8090/api'
const PORT = 9361
const OUT = path.join(process.env.TEMP, 'yinjia-org-shots')
const PROBE_USER = 'zz_probe_uidel'
const PROBE_PWD = 'Probe@12345'
const CANDS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
]
const EDGE = CANDS.find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')) }
}

async function api(method, p, { token, body } = {}) {
  const res = await fetch(API + p, {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  let json = null
  try { json = await res.json() } catch { /* ignore */ }
  return { code: json?.code, message: json?.message, data: json?.data }
}

async function findUser(token, userName) {
  const r = await api('GET', '/sys/user/list', { token })
  return (r.data || []).find((u) => u.userName === userName) || null
}

async function main() {
  if (!EDGE) throw new Error('找不到 Edge/Chrome')
  fs.mkdirSync(OUT, { recursive: true })

  const login = await api('POST', '/auth/login', { body: { userName: 'admin', password: '123456' } })
  const token = login.data?.token
  const user = login.data?.user
  if (!token) throw new Error('登录失败')

  // 清残留 + 建一个待删账号(用 API 建,界面负责删)
  let stale = await findUser(token, PROBE_USER)
  if (stale) { await api('DELETE', '/sys/user/' + stale.id, { token }); stale = null }
  const mk = await api('POST', '/sys/user/save', {
    token, body: { userName: PROBE_USER, password: PROBE_PWD, realName: '界面探针-待删账号', enabled: 1 },
  })
  if (mk.code !== 200) throw new Error('建临时账号失败: ' + JSON.stringify(mk))
  const probe = await findUser(token, PROBE_USER)
  console.log('[setup] 临时账号 id=' + probe.id + ' 已建\n')

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'org-ui-'))
  const edge = spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1700,1150', 'about:blank',
  ], { stdio: 'ignore' })

  try {
    let target = null
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(300)
      try {
        const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
        target = list.find((t) => t.type === 'page')
      } catch { /* 未就绪 */ }
    }
    if (!target) throw new Error('CDP 未就绪')

    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let id = 0
    const pend = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
    const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
      if (r.result?.exceptionDetails) throw new Error('页面执行异常: ' + r.result.exceptionDetails.text)
      return r.result?.result?.value
    }
    const shot = async (name) => {
      const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true })
      const f = path.join(OUT, name)
      if (s.result?.data) fs.writeFileSync(f, Buffer.from(s.result.data, 'base64'))
      return f
    }

    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1150, deviceScaleFactor: 1, mobile: false })

    // ① 登录态注入(走 localStorage,与前端一致)+ 打开组织架构
    // ⚠ 注入后必须先跳 about:blank 再进目标路由:直接改 hash 不会重新加载应用,
    //   Pinia 里 token 仍是空,路由守卫会把管理员弹回登录页(实测踩到)。
    await send('Page.navigate', { url: FRONT + '/#/login' })
    await sleep(1500)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-09-23'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' })
    await sleep(600)
    await send('Page.navigate', { url: FRONT + '/#/sys/org' })
    await sleep(4000)
    await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 'x' })()`)
    await sleep(1200)

    // ② 表格里找到目标行,断言删除按钮的显示规则
    const rowsInfo = await evaluate(`(() => {
      const rows = [...document.querySelectorAll('.el-table__row')]
      const pick = (n) => rows.find((r) => (r.innerText || '').includes(n))
      const btn = (r, t) => r ? [...r.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === t) : null
      const adminRow = pick('admin')
      const probeRow = pick(${JSON.stringify(PROBE_USER)})
      const demoRow = pick('tester01')
      return {
        rowCount: rows.length,
        adminHasDel: !!btn(adminRow, '删除'),
        adminHasEdit: !!btn(adminRow, '编辑'),
        probeHasDel: !!btn(probeRow, '删除'),
        otherHasDel: !!btn(demoRow, '删除'),
        tip: (document.querySelector('.org-col.users')?.innerText || '').includes('不可删除'),
      }
    })()`)
    console.log('界面结构:' + JSON.stringify(rowsInfo))
    ok('U1 组织架构页加载出用户表', rowsInfo.rowCount > 0, 'rows=' + rowsInfo.rowCount)
    ok('U2 管理员行【没有】删除按钮(也不影响编辑)', rowsInfo.adminHasDel === false && rowsInfo.adminHasEdit === true)
    ok('U3 普通账号行【有】删除按钮', rowsInfo.probeHasDel === true && rowsInfo.otherHasDel === true)
    ok('U4 列下提示写明不可删规则', rowsInfo.tip === true)

    // ③ 点击删除 → 中文确认弹窗
    // 按钮文案随语言变化,选择器一律用 /删除|Delete/ 之类语言无关匹配(实测:写死「删除」在英文态点不到)
    const openDialog = `(() => {
      const rows = [...document.querySelectorAll('.el-table__row')]
      const row = rows.find((r) => (r.innerText || '').includes(${JSON.stringify(PROBE_USER)}))
      if (!row) return 'row-not-found'
      const btns = [...row.querySelectorAll('button')]
      const btn = btns.find((b) => /删除|Delete/i.test((b.innerText || '').trim())) || btns[btns.length - 1]
      if (!btn) return 'btn-not-found'
      btn.click(); return 'clicked'
    })()`
    await evaluate(openDialog)
    await sleep(900)
    const zh = await evaluate(`(() => {
      const box = document.querySelector('.el-message-box')
      if (!box) return { visible: false }
      return {
        visible: true,
        title: (box.querySelector('.el-message-box__title')?.innerText || '').trim(),
        msg: (box.querySelector('.el-message-box__message')?.innerText || '').trim(),
        btns: [...box.querySelectorAll('.el-message-box__btns button')].map((b) => (b.innerText || '').trim()),
      }
    })()`)
    console.log('中文弹窗:' + JSON.stringify(zh))
    ok('U5 弹出确认框且标题为「提示」', zh.visible === true && zh.title === '提示', JSON.stringify(zh))
    ok('U6 弹窗文案含账号名与后果说明', /zz_probe_uidel/.test(zh.msg) && /历史单据/.test(zh.msg), zh.msg)
    ok('U7 按钮为 确定 / 取消', zh.btns.includes('确定') && zh.btns.includes('取消'), JSON.stringify(zh.btns))
    const shotZh = await shot('org-user-del-confirm-zh.png')
    console.log('  截图 → ' + shotZh)

    // ④ 点取消 → 不删(按钮文案随语言,用语言无关匹配)
    await evaluate(`(() => { const b=[...document.querySelectorAll('.el-message-box__btns button')].find(x=>/取消|Cancel/i.test(x.innerText)); b.click(); return 'x' })()`)
    await sleep(800)
    ok('U8 取消后没有删除(账号仍在)', !!(await findUser(token, PROBE_USER)))

    // ⑤ 切英文 → 弹窗文案应为英文(同样要先整页重载,语言才生效)
    await evaluate(`localStorage.setItem('mes_locale','en'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' })
    await sleep(600)
    await send('Page.navigate', { url: FRONT + '/#/sys/org' })
    await sleep(4000)
    await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 'x' })()`)
    await sleep(1200)
    await evaluate(openDialog)
    await sleep(900)
    const en = await evaluate(`(() => {
      const box = document.querySelector('.el-message-box')
      if (!box) return { visible: false }
      return {
        visible: true,
        title: (box.querySelector('.el-message-box__title')?.innerText || '').trim(),
        msg: (box.querySelector('.el-message-box__message')?.innerText || '').trim(),
        btns: [...box.querySelectorAll('.el-message-box__btns button')].map((b) => (b.innerText || '').trim()),
      }
    })()`)
    console.log('英文弹窗:' + JSON.stringify(en))
    ok('U9 切英文后标题为 Notice', en.title === 'Notice', en.title)
    ok('U10 切英文后正文为英文且保留账号名', /^Delete account/.test(en.msg) && /zz_probe_uidel/.test(en.msg), en.msg)
    ok('U11 切英文后按钮为 OK / Cancel(不再是中文)', en.btns.includes('OK') && en.btns.includes('Cancel'), JSON.stringify(en.btns))
    const shotEn = await shot('org-user-del-confirm-en.png')
    console.log('  截图 → ' + shotEn)

    // ⑥ 确认删除 → 行消失 + 成功提示
    await evaluate(`(() => { const b=[...document.querySelectorAll('.el-message-box__btns button')].find(x=>/OK|确定/.test(x.innerText)); b.click(); return 'x' })()`)
    await sleep(1800)
    const after = await evaluate(`(() => ({
      stillInTable: [...document.querySelectorAll('.el-table__row')].some((r)=>(r.innerText||'').includes(${JSON.stringify(PROBE_USER)})),
      toast: [...document.querySelectorAll('.el-message')].map((e)=>e.innerText.trim()).join(' | '),
    }))()`)
    console.log('删除后:' + JSON.stringify(after))
    ok('U12 删除后表里不再有该行', after.stillInTable === false)
    ok('U13 出现成功提示', /删除|delet/i.test(after.toast), after.toast)
    ok('U14 API 复核账号确实已删', !(await findUser(token, PROBE_USER)))
    const shotDone = await shot('org-user-del-done.png')
    console.log('  截图 → ' + shotDone)

    ws.close()
  } finally {
    edge.kill()
    const left = await findUser(token, PROBE_USER)
    if (left) {
      const c = await api('DELETE', '/sys/user/' + left.id, { token })
      console.log('[cleanup] 兜底删除残留 → code=' + c.code)
    }
    console.log('[cleanup] 残留检查: ' + ((await findUser(token, PROBE_USER)) ? '⚠ 仍在' : '无残留 ✓'))
  }

  console.log('\n== 结果:' + pass + ' 通过 / ' + fail + ' 失败 ==')
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
