/**
 * 探针:组织架构「角色权限配置」能否退回三列布局(测试账套 YJ_TEST)
 *
 * 现象(用户 2026-10-15 报):点角色行 → 布局切成上下(权限矩阵独占整行),
 *   **没有任何返回入口**;el-table 的 current-change 对"再点同一行"不触发 ⇒ 退不回去,
 *   只能退出网页再进来。
 * 断言:① 进配置态后确实变成上下布局 ② perm-head 里有「返回」 ③ 点它回到三列
 *   ④ **再点同一角色行还能重新打开**(防止只清 selRole、忘了清表格 currentRow 导致永远打不开)
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const BASE = 'http://127.0.0.1:8090'
const API = BASE + '/api'
const FACTORY = 'YJ_TEST'
const ROLE_CODE = 'rd_review'
const PORT = 9361
const OUT = path.join(process.env.TEMP, 'mes-org-perm')
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let fails = 0
const chk = (id, name, ok, detail) => {
  console.log(`  ${ok ? '\u2713' : '\u2717'} [${id}] ${name}${detail === undefined ? '' : '  → ' + detail}`)
  if (!ok) fails++
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const lr = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
  })
  const lj = await lr.json()
  const tok = lj?.data?.token
  const user = lj?.data?.user
  if (!tok) throw new Error('登录失败')

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'org-perm-'))
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1440,1000', 'about:blank'], { stdio: 'ignore' })
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
    const pend = new Map(); const errs = []
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push((m.params.args || []).map((a) => a.value || a.description).join(' ').slice(0, 150))
    }
    const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
    const ev = async (x) => {
      const r = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })
      if (r.result && r.result.exceptionDetails) return '[JS异常] ' + r.result.exceptionDetails.text
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const shot = async (n) => {
      const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
      fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from(s.result.data, 'base64'))
      console.log('  shot → ' + path.join(OUT, n + '.png'))
    }
    // 布局快照:.perm-box 在不在 + 角色栏占整行宽度的比例(上下模式≈1,三列模式≈0.33)
    const SNAP = `(() => {
      const wrap = document.querySelector('.org-wrap')
      if (!wrap) return null
      const roles = document.querySelector('.org-col.roles')
      const w = wrap.getBoundingClientRect().width || 1
      const bw = roles ? roles.getBoundingClientRect().width : 0
      return { permBox: !!document.querySelector('.perm-box'), ratio: Math.round((bw / w) * 100) / 100,
               backBtns: [...document.querySelectorAll('.perm-head button, .perm-head .el-button')].map(b => b.innerText.trim()) }
    })()`
    const clickRole = `(() => {
      const rows = [...document.querySelectorAll('.org-col.roles .el-table__row')]
      const r = rows.find(x => [...x.querySelectorAll('td')].some(td => td.innerText.trim() === ${JSON.stringify(ROLE_CODE)}))
      if (!r) return 'row-not-found:' + rows.length
      r.click(); return 'clicked'
    })()`
    const clickBack = `(() => {
      const b = [...document.querySelectorAll('.perm-head button, .perm-head .el-button')].find(x => /返回|Back/.test(x.innerText))
      if (!b) return 'no-back-btn'; b.click(); return 'clicked'
    })()`

    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2000)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(tok)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-10-15'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
    await send('Page.navigate', { url: BASE + '/#/sys/org' }); await sleep(5000)

    const s0 = await ev(SNAP)
    chk('B0', '初始是三列布局(无权限矩阵,角色栏约 1/3 宽)', s0 && !s0.permBox && s0.ratio < 0.5,
      `permBox=${s0?.permBox} ratio=${s0?.ratio}`)
    await shot('01-three-columns')

    const c1 = await ev(clickRole)
    await sleep(1800)
    const s1 = await ev(SNAP)
    chk('B1', `点角色 ${ROLE_CODE} → 进入权限配置态(矩阵出现、布局变上下)`,
      c1 === 'clicked' && s1 && s1.permBox && s1.ratio > 0.9, `click=${c1} permBox=${s1?.permBox} ratio=${s1?.ratio}`)
    await shot('02-perm-stacked')

    chk('B2', '配置态里有「返回」按钮  ← 本次要补的', Array.isArray(s1?.backBtns) && s1.backBtns.some((t) => /返回|Back/.test(t)),
      JSON.stringify(s1?.backBtns))

    const cb = await ev(clickBack)
    await sleep(1200)
    const s2 = await ev(SNAP)
    chk('B3', '点「返回」→ 回到三列布局(矩阵消失、角色栏回到约 1/3)',
      cb === 'clicked' && s2 && !s2.permBox && s2.ratio < 0.5, `click=${cb} permBox=${s2?.permBox} ratio=${s2?.ratio}`)
    await shot('03-back-to-three')

    const c2 = await ev(clickRole)
    await sleep(1800)
    const s3 = await ev(SNAP)
    chk('B4', '返回后再点同一角色 → 还能重新打开  ← 防止只清 selRole 忘了清表格 currentRow',
      c2 === 'clicked' && s3 && s3.permBox, `click=${c2} permBox=${s3?.permBox}`)

    console.log('  [console 报错] ' + (errs.length ? JSON.stringify(errs) : '无'))
    ws.close()
  } finally { edge.kill() }

  console.log('')
  if (fails === 0) console.log('[PASS] 角色权限配置态可返回三列布局')
  else { console.log(`[FAIL] ${fails} 项不符`); process.exit(1) }
}
main().catch((e) => { console.error('FATAL ' + e.message); process.exit(1) })
