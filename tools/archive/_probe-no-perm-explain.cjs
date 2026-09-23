/**
 * 临时探针 v2(2026-09-22):无权限面板是否"解释"
 *   v1 的教训:ElMessage 默认 3 秒后消失,4.2 秒才采样会漏;对照组断言也写错了(RD_APPROVAL 是文件面板,没有 el-table)
 *   v2 做法:① 载入前挂 MutationObserver 持续记录 .el-message;② 直接看接口原始返回;③ 对照只断言"无权限错误 + 有内容"
 * 前置:测试库 admin 已降级(夹具),跑完恢复。
 * 用法: node --experimental-websocket tools/archive/_probe-no-perm-explain.cjs [FRONT]
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const FRONT = process.argv[2] || 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9379
const NO_PERM = 'BOM'
const HAS_PERM = 'RD_APPROVAL'
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

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const lr = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })
  const login = await lr.json()
  const token = login.data && login.data.token
  const user = login.data && login.data.user
  if (!token) throw new Error('测试账套登录失败')

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'no-perm2-'))
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

    // 先装"消息记录器":界面里出现过的所有 el-message 都留痕(不依赖采样时机)
    const INSTALL = `(() => {
      window.__msgs = window.__msgs || []
      const rec = (root) => {
        root.querySelectorAll && root.querySelectorAll('.el-message').forEach((e) => {
          const t = (e.innerText || '').trim()
          if (t && !window.__msgs.includes(t)) window.__msgs.push(t)
        })
      }
      rec(document)
      if (!window.__mo) {
        window.__mo = new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) rec(n.parentNode || document); })))
        window.__mo.observe(document.documentElement, { childList: true, subtree: true })
      }
      return 'installed'
    })()`

    await send('Page.navigate', { url: `${FRONT}/#/login` }); await sleep(1700)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_factory', JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }));
localStorage.setItem('mes_login_date','2026-09-22'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
    await send('Page.navigate', { url: `${FRONT}/#/dashboard` }); await sleep(4000)
    await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 'skip' })()`)
    await sleep(900)
    console.log('  消息记录器: ' + await evaluate(INSTALL))

    console.log('\n【0】接口原始返回(证明后端是 HTTP 200 + body code 403)')
    const raw = await evaluate(`(async () => {
      const t = localStorage.getItem('mes_token')
      const r = await fetch('/api/px/queryFormDataList', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + t }, body: JSON.stringify({ panelCode: '${NO_PERM}', condition: {}, pageNo: 1, pageSize: 20 }) })
      return { http: r.status, body: await r.json() }
    })()`)
    chk('后端:HTTP 200 且 body.code=403', raw.http === 200 && raw.body.code === 403, raw)
    chk('后端:附了可读原因', /无该面板|无权限|查看权限/.test(String(raw.body.message)), raw.body.message)

    console.log('\n【1】访问无权限面板 ' + NO_PERM + '(持续观察消息)')
    await send('Page.navigate', { url: `${FRONT}/#/panelx/list/${NO_PERM}` })
    // 消息只活 3 秒 ⇒ 一出现就截图(否则截到的是"已经消失"的页面)
    let shotTaken = false
    for (let i = 0; i < 24; i++) {
      await sleep(400)
      const seen = await evaluate(`(window.__msgs || []).length`)
      if (seen > 0) { await shot('no-perm-explain'); shotTaken = true; break }
      if (i === 6) await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 'skip' })()`)
    }
    await sleep(1200)
    if (!shotTaken) await shot('no-perm-explain')
    const denied = await evaluate(`(() => {
      const t = localStorage.getItem('mes_token') || ''
      return { msgs: window.__msgs || [], hash: location.hash, loggedIn: !!t && t.length > 20,
               rows: document.querySelectorAll('.el-table__row').length, text: (document.body.innerText||'').replace(/\\s+/g,' ').slice(0,120) }
    })()`)
    chk('出现错误提示(不再是静默空表)', denied.msgs.length > 0, denied.msgs)
    chk('提示说明是权限原因', denied.msgs.some((m) => /无该面板|无权限|查看权限/.test(m)), denied.msgs)
    chk('仍保持登录且没被踢到登录页', denied.loggedIn === true && !denied.hash.includes('/login'), denied.hash)
    await shot('no-perm-explain')

    console.log('\n【2】对照:有权限面板 ' + HAS_PERM)
    await sleep(3500)   // 等上一条 ElMessage(3s 生命周期)彻底退场,否则会被观察器重复记录
    await evaluate(`window.__msgs = []`)
    await send('Page.navigate', { url: `${FRONT}/#/panelx/list/${HAS_PERM}` })
    await sleep(6000)
    const ok = await evaluate(`(() => ({ msgs: window.__msgs || [], text: (document.body.innerText||'').replace(/\\s+/g,' ').slice(0,150) }))()`)
    chk('没有"无权限"这类错误', !ok.msgs.some((m) => /无该面板|无权限|查看权限/.test(m)), ok.msgs)
    chk('页面有实质内容(非白屏)', ok.text.length > 40, ok.text.slice(0, 90))
    await shot('no-perm-control-ok')
  } finally {
    edge.kill()
  }
  console.log(fails ? '\n结果:' + fails + ' 项未通过' : '\n结果:全部通过')
  process.exit(fails ? 1 : 0)
}
main().catch((e) => { console.error('FAIL: ' + (e && e.message)); process.exit(1) })
