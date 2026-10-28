/**
 * _q-wo-pick-widths.cjs — 工单扫码领料页 三档宽度验收(2026-10-21)
 *
 * 为什么要这一支:原先页面写死单列 max-width:640px,在 2549px 电脑屏上缩成中间一条窄带
 * (用户 2026-10-21 报「电脑上看是这样子」)。改成宽屏双栏后,必须逐档验证:
 *   · 1440 / 1920:双栏(左=工单+秤,右=清单+扫码),无横向滚动
 *   · 375:单列,提交栏固定底部,无横向滚动
 *
 * 用法:node tools/archive/_wo-pick-20261021/_q-wo-pick-widths.cjs [端口]
 */
const { spawn, execSync } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const PORT = process.argv[2] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9484
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const state = `(function(){
  var q = function(s){ var e=document.querySelector(s); return e ? e.innerText.trim() : ''; };
  var grid = document.querySelector('.wop-grid');
  var cs = grid ? getComputedStyle(grid) : null;
  var foot = document.querySelector('.wop-foot');
  var fs = foot ? getComputedStyle(foot) : null;
  var page = document.querySelector('.wop-page');
  var ps = page ? getComputedStyle(page) : null;
  return JSON.stringify({
    cols: cs ? cs.gridTemplateColumns : '',
    pageW: page ? Math.round(page.getBoundingClientRect().width) : 0,
    pagePad: ps ? ps.padding : '',
    footPos: fs ? fs.position : '',
    rowCount: document.querySelectorAll('.wop-row').length,
    firstRow: (document.querySelector('.wop-row')||{}).innerText ? document.querySelector('.wop-row').innerText.replace(/\\s+/g,' ').trim() : '',
    scale: q('.wop-scale-val'),
    orderNo: q('.wop-order-no'),
    bodyW: document.body.scrollWidth, innerW: window.innerWidth,
    overflowX: document.body.scrollWidth > window.innerWidth + 1
  });
})()`

/** 插一条实时秤读数(让页面有真实重量可显示) */
function insertReading(value) {
  const sql = `INSERT INTO dbo.bs_dc_sample (device_id, point_id, value_num, value_text, quality, collect_at, asp_user1, asp_time1, asp_cancel) VALUES (1, 6, ${value}, N'${value}', 'G', SYSDATETIME(), N'probe-live', SYSDATETIME(), 'N');`
  fs.writeFileSync(path.join(os.tmpdir(), '_ins-scale2.sql'), sql, 'utf8')
  try {
    execSync(`java -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar ${path.join(os.tmpdir(), 'RunQ.java')} ${path.join(os.tmpdir(), '_ins-scale2.sql')}`, {
      cwd: path.join(__dirname, '..', '..'), stdio: 'ignore', env: { ...process.env, YINJIA_SQL_PASS: 'Yinjia@2026' },
    })
  } catch (e) { /* 忽略 */ }
}

async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const lj = await lr.json()
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), '_wopw'), 'about:blank'], { stdio: 'ignore', detached: true })
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(3000)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload'); await sleep(8000)

  await ev('location.hash = "#/scm/workOrderPick"'); await sleep(3500)
  // 扫工单
  await ev(`(function(){
    var inp = document.querySelectorAll('.wop-input')[0];
    inp.value = 'YJ@GD-2026-10-0220@1001';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
  })()`)
  await sleep(3500)
  insertReading('12.5'); await sleep(2600)
  insertReading('12.5'); await sleep(2600)

  for (const w of [1440, 1920, 375]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: w, height: w === 375 ? 760 : 900, deviceScaleFactor: 1, mobile: w === 375,
    })
    await sleep(1500)
    console.log(`W${w} ` + await ev(state))
    await shot(`_wo-width-${w}.png`)
  }

  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
