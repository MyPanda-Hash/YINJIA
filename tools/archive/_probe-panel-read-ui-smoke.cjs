/**
 * 临时探针(2026-09-22):加了 requirePanelRead 闸门后,受限账号的列表页/表单页是否照常可用
 *   (getPanelConfig / getNewFormPermMatrix 就在这两条路径上,必须确认没被自己加的闸门打断)
 * 前置:测试库存在 switchprobe(受限账号,密码 123456)。
 * 用法: node --experimental-websocket D:\DSHTemp\_probe-guard-ui-smoke.cjs [FRONT] [PANEL]
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const FRONT = process.argv[2] || 'http://localhost:5173'
const PANEL = process.argv[3] || 'RD_DROP_PREC'
const API = 'http://localhost:8090/api'
const PORT = 9381
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
    body: JSON.stringify({ userName: 'switchprobe', password: '123456', factory: 'YJ_TEST' }),
  })
  const login = await lr.json()
  const token = login.data && login.data.token
  const user = login.data && login.data.user
  if (!token) throw new Error('受限账号登录失败(夹具是否已建?)')

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-smoke-'))
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
    const INSTALL = `(() => {
      window.__msgs = window.__msgs || []
      const rec = (root) => { root.querySelectorAll && root.querySelectorAll('.el-message').forEach((e) => { const t = (e.innerText||'').trim(); if (t && !window.__msgs.includes(t)) window.__msgs.push(t) }) }
      rec(document)
      if (!window.__mo) { window.__mo = new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) rec(n.parentNode || document) }))); window.__mo.observe(document.documentElement, { childList: true, subtree: true }) }
      return 'installed'
    })()`
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: `${FRONT}/#/login` }); await sleep(1700)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_factory', JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }));
localStorage.setItem('mes_login_date','2026-09-22'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
    await send('Page.navigate', { url: `${FRONT}/#/panelx/list/${PANEL}` }); await sleep(2500)
    await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 'skip' })()`)
    await evaluate(INSTALL)
    await sleep(4000)

    console.log('\n【列表页】' + PANEL)
    const list = await evaluate(`(() => ({ msgs: window.__msgs || [], hasTable: !!document.querySelector('.el-table'), text: (document.body.innerText||'').replace(/\\s+/g,' ') }))()`)
    chk('列表页无"无权限/读取权限"错误', !list.msgs.some((m) => /无该面板|无权限|读取权限/.test(m)), list.msgs)
    // 记录表面板走纸张版式(不是 el-table),所以按"有实质内容"判,不绑元素类型
    chk('列表页渲染出实质内容(纸张版式或表格)', list.text.length > 120, { len: list.text.length, sample: list.text.slice(0, 80) })
    console.log('  INFO  含 el-table=' + list.hasTable + ' (记录表面板为纸张版式,正常)')
    await shot('guard-smoke-list')

    console.log('\n【表单页(新增)】' + PANEL)
    await evaluate(`window.__msgs = []`)
    await sleep(3400)
    await send('Page.navigate', { url: `${FRONT}/#/panelx/form/${PANEL}` }); await sleep(5200)
    const form = await evaluate(`(() => ({ msgs: window.__msgs || [], inputs: document.querySelectorAll('input, textarea').length, text: (document.body.innerText||'').replace(/\\s+/g,' ') }))()`)
    chk('表单页无"无权限/读取权限"错误', !form.msgs.some((m) => /无该面板|无权限|读取权限/.test(m)), form.msgs)
    chk('表单页渲染出字段与单据编号(闸门没把配置挡住)', form.inputs > 0 && /单据编号|编号/.test(form.text), { inputs: form.inputs, hasNo: /单据编号/.test(form.text) })
    await shot('guard-smoke-form')
  } finally {
    edge.kill()
  }
  console.log(fails ? '\n结果:' + fails + ' 项未通过' : '\n结果:全部通过')
  process.exit(fails ? 1 : 0)
}
main().catch((e) => { console.error('FAIL: ' + (e && e.message)); process.exit(1) })
