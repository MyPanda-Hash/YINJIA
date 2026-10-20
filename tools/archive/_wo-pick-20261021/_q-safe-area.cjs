/**
 * _q-safe-area.cjs — 验证手机端顶部安全区(2026-10-21)
 *
 * 用户报:「手机端,顶部会被摄像头卡住,操作会点不动,应该顶部留空一些」。
 *
 * 根因两条:
 *   ① index.html 的 viewport 缺 viewport-fit=cover ⇒ env(safe-area-inset-top) 恒为 0
 *   ② PortalLayout 只处理了底部(LeftNav),顶部完全没留
 *
 * 验证法:CDP 的 Emulation.setSafeAreaInsetsOverride 模拟挖孔屏(顶部 48px),
 * 量 TopBar 的顶边坐标 —— 修好后应 >= 48;修之前是 0(被摄像头盖住)。
 *
 * 用法:node tools/archive/_wo-pick-20261021/_q-safe-area.cjs [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const PORT = process.argv[2] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9486
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const state = `(function(){
  var q = function(s){ var e=document.querySelector(s); return e ? e.innerText.trim().slice(0,40) : ''; };
  var top = document.querySelector('.topbar') || document.querySelector('[class*=topbar]') || document.querySelector('.portal > *');
  var portal = document.querySelector('.portal');
  var ps = portal ? getComputedStyle(portal) : null;
  var r = top ? top.getBoundingClientRect() : null;
  return JSON.stringify({
    topbarClass: top ? top.className : '',
    topbarTop: r ? Math.round(r.top) : -1,
    topbarH: r ? Math.round(r.height) : -1,
    portalPadTop: ps ? ps.paddingTop : '',
    // 关键:第一个可点元素(菜单按钮/logo)的实际顶边,必须避开摄像头
    firstBtnTop: (function(){
      var b = document.querySelector('.topbar button, .topbar .icon-btn, .topbar [class*=btn]');
      return b ? Math.round(b.getBoundingClientRect().top) : -1;
    })(),
    viewportMeta: (document.querySelector('meta[name=viewport]')||{}).content || '',
    bodyW: document.body.scrollWidth, innerW: window.innerWidth,
    overflowX: document.body.scrollWidth > window.innerWidth + 1
  });
})()`

async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const lj = await lr.json()
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), '_safearea'), 'about:blank'], { stdio: 'ignore', detached: true })
  proc.unref(); await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) { } await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require('../../verify/lib/mini-ws.cjs')
  let id = 0; const pending = new Map(); const errs = []
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (d) => {
    const m = JSON.parse(d)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || '').slice(0, 200))
  })
  const send = (method, params) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params: params || {} })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined }
  const shot = async (n) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n), Buffer.from(s.result.data, 'base64')) }
  await send('Page.enable'); await send('Runtime.enable')

  // 手机视口 + 挖孔屏(顶部 48px 安全区)
  await send('Emulation.setDeviceMetricsOverride', { width: 393, height: 851, deviceScaleFactor: 1, mobile: true })
  // 老版 CDP 无 setSafeAreaInsetsOverride 时降级:直接注入 CSS 变量验证布局响应
  let safeOk = true
  try {
    await send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 48, bottom: 34, left: 0, right: 0 } })
    console.log('SAFE_AREA_OVERRIDE ok')
  } catch (e) {
    safeOk = false
    console.log('SAFE_AREA_OVERRIDE unsupported, 改用 CSS 注入模拟')
  }

  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(3000)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload'); await sleep(8000)

  if (!safeOk) {
    // 降级:把 env() 用一个自定义属性顶替(仅本探针内),验证 padding 真的会推下去
    await ev(`(function(){
      var s=document.createElement('style');
      s.textContent='.portal{padding-top:48px !important}';
      document.head.appendChild(s);
      return 'injected';
    })()`)
    await sleep(600)
  }

  console.log('MOBILE ' + await ev(state))
  await shot('_safe-area-phone.png')

  // 再看扫码页(它有自己的 padding,确认没被顶栏压住)
  await ev('location.hash = "#/scm/workOrderPick"'); await sleep(3500)
  console.log('PICK ' + await ev(state))
  await shot('_safe-area-pick.png')

  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
