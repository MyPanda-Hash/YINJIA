/**
 * _scale-live.cjs — 实时验证「秤取数」链路(2026-10-21)
 *
 * 为什么要单独一支:主探针 _q-wo-pick.cjs 启动要 20+ 秒(登录+导航+扫码),
 * 而 checkScaleReading 要求读数在 10 秒窗口内 —— 页面打开时探针塞进去的
 * 实时值早就过期,永远显示「跳动」。这里改成:页面已就绪后**边插数据边读**。
 *
 * 做法:页面停在工单页 → 每 3 秒调一次 /dc/monitor 看读数与 hint,
 * 期间用 SQL 持续插入实时重量,观察 hint 是否从「跳动」变「稳定」。
 *
 * 用法:node tools/archive/_wo-pick-20261021/_scale-live.cjs [端口]
 */
const { spawn, execSync } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const PORT = process.argv[2] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9482
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const state = `(function(){
  var q = function(s){ var e=document.querySelector(s); return e ? e.innerText.trim() : ''; };
  return JSON.stringify({
    scale: q('.wop-scale-val'),
    hint: q('.wop-scale-hint'),
    cls: (document.querySelector('.wop-scale')||{}).className || '',
    rows: document.querySelectorAll('.wop-row').length,
    firstRow: (document.querySelector('.wop-row')||{}).innerText ? document.querySelector('.wop-row').innerText.replace(/\\s+/g,' ').trim() : '',
    ok: q('.wop-ok'),
    err: q('.wop-err')
  });
})()`

/** 插一条实时重量(用 tools 下的 DbSync 同款连接串) */
function insertReading(value) {
  const sql = `INSERT INTO dbo.bs_dc_sample (device_id, point_id, value_num, value_text, quality, collect_at, asp_user1, asp_time1, asp_cancel) VALUES (1, 6, ${value}, N'${value}', 'G', SYSDATETIME(), N'probe-live', SYSDATETIME(), 'N');`
  fs.writeFileSync(path.join(os.tmpdir(), '_ins-scale.sql'), sql, 'utf8')
  try {
    execSync(`java -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar ${path.join(os.tmpdir(), 'RunQ.java')} ${path.join(os.tmpdir(), '_ins-scale.sql')}`, {
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
    '--user-data-dir=' + path.join(os.tmpdir(), '_scalelive'), 'about:blank'], { stdio: 'ignore', detached: true })
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
  await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 900, deviceScaleFactor: 1, mobile: true })
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
  await sleep(4000)
  console.log('LOADED ' + await ev(state))

  // 边插实时数据边观察(页面每 2 秒轮询一次)
  for (let round = 0; round < 6; round++) {
    insertReading('12.5')
    await sleep(2600)
    console.log(`ROUND${round} ` + await ev(state))
  }
  await shot('_wo-scale-live.png')

  // 扫物料码,看是否取到秤值并累加
  const typed = await ev(`(function(){
    var inps = document.querySelectorAll('.wop-input');
    var inp = inps[inps.length-1];
    inp.value = 'M-001|';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    return 'ok';
  })()`)
  await sleep(1200)
  insertReading('12.5')
  await sleep(2500)
  console.log('AFTER_SCAN ' + await ev(state))
  await shot('_wo-scale-scanned.png')

  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
