/** _q-menu.cjs — 生产制造菜单合并活体取证(2026-10-18)
 *  断言:侧栏「生产制造」下出现「生产过程」,且不再有「生产执行」「生产记录」;
 *        生产过程组展开后叶子 = 原执行 4 项 + 原记录 6 项(顺序不变)。
 *  DOM 依据 frontend/src/layout/LeftNav.vue:一级 .nav-group → 二级 .nav-module → 叶子 .fly-card .card-item
 *  用法(node,仓库根):node tools/archive/_mfg-merge-20261018/_q-menu.cjs [账号] [口令] [工厂] [端口]
 *    端口默认 5173(vite 源码即时生效);工厂 YJ=正式账套 / YJ_TEST=测试账套;API 仍打 8090。
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const ACC = process.argv[2] || 'admin'
const PWD = process.argv[3] || '123456'
const FACTORY = process.argv[4] || 'YJ'
const PORT = process.argv[5] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9457
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = 0
const FAIL = (m) => { console.log('FAIL ' + m); failed++ }
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const clickSel = (sel, text) => `(function(){ var ns = document.querySelectorAll(${JSON.stringify(sel)});
  for (var i=0;i<ns.length;i++){ if ((ns[i].innerText||'').trim() === ${JSON.stringify(text)}){ ns[i].click(); return true } }
  return false })()`

async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: ACC, password: PWD, factory: FACTORY }),
  })
  const lj = await lr.json()
  if (!lj.data || !lj.data.token) { FAIL('LOGIN ' + JSON.stringify(lj).slice(0, 200)); return }
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {})

  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), '_mfgq_' + ACC), 'about:blank'], { stdio: 'ignore', detached: true })
  proc.unref(); await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) { } await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require('../../verify/lib/mini-ws.cjs')
  let id = 0; const pending = new Map(); const errs = []; const http5xx = []
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (d) => {
    const m = JSON.parse(d)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || '').slice(0, 200))
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) {
      http5xx.push(m.params.response.status + ' ' + (m.params.response.url || ''))
    }
  })
  const send = (method, params) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params: params || {} })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined }
  const shot = async (n) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n), Buffer.from(s.result.data, 'base64')) }
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(3000)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload'); await sleep(8000)
  console.log('AUTH ' + await ev('JSON.stringify({ hash: location.hash, token: !!localStorage.getItem("mes_token") })'))

  // ① 展开一级「生产制造」
  const mfgClicked = await ev(clickSel('.nav-group', '生产制造'))
  await sleep(1500)
  console.log('MFG_CLICK ' + mfgClicked)
  if (!mfgClicked) FAIL('侧栏找不到一级「生产制造」')

  // ② 二级目录标题(只读 .nav-module,不落 body —— body 里还有桌面的「生产执行核心」卡片)
  const mods = await ev(`(function(){ return JSON.stringify(Array.prototype.map.call(document.querySelectorAll('.nav-module'), function(n){ return (n.innerText||'').trim() })) })()`)
  console.log('MODULES ' + mods)
  const modList = JSON.parse(mods || '[]')
  const wantMods = ['生产计划', '生产过程', '设备维护']
  if (modList.join(',') !== wantMods.join(',')) FAIL('二级目录不符,期望=' + wantMods.join(',') + ' 实际=' + modList.join(','))
  if (modList.indexOf('生产执行') >= 0) FAIL('二级仍有「生产执行」')
  if (modList.indexOf('生产记录') >= 0) FAIL('二级仍有「生产记录」')

  // ③ 打开「生产过程」组,读叶子(顺序敏感)
  const procClicked = await ev(clickSel('.nav-module', '生产过程'))
  await sleep(2000)
  console.log('PROC_CLICK ' + procClicked)
  const leaves = await ev(`(function(){ return JSON.stringify(Array.prototype.map.call(document.querySelectorAll('.fly-card .card-group'), function(g){
     var t=(g.querySelector('.card-group-title')||{}).innerText||'';
     var items=Array.prototype.map.call(g.querySelectorAll('.card-item'), function(i){ return (i.innerText||'').trim() });
     return { group: t, items: items };
  })) })()`)
  console.log('FLY_CARD ' + leaves)
  const cards = JSON.parse(leaves || '[]').flatMap((c) => c.items)
  const want = ['工序报工单', '报工记录', '完工明细', '生产异常处理单', '生产日报表', '投料确认单', '物料混合记录', '造粒记录', '无黑处理登记', '封箱确认']
  if (cards.join(',') !== want.join(',')) FAIL('叶子不符,期望=' + want.join(',') + ' 实际=' + cards.join(','))
  await shot('_mfg-menu-1440-' + ACC + '.png')

  // ④ 路由仍通:原「生产记录」组的面板与原「生产执行」组的面板各进一张
  await ev('location.hash = "#/panelx/list/DAY_REPORT"'); await sleep(4000)
  const r1 = await ev('JSON.stringify({ hash: location.hash, bodyHasTitle: document.body.innerText.indexOf("生产日报表")>=0 })')
  console.log('ROUTE_DAY_REPORT ' + r1)
  if (JSON.parse(r1).hash !== '#/panelx/list/DAY_REPORT') FAIL('DAY_REPORT 路由未生效')
  await ev('location.hash = "#/panelx/list/WO_REPORT"'); await sleep(4000)
  const r2 = await ev('JSON.stringify({ hash: location.hash, bodyHasTitle: document.body.innerText.indexOf("工序报工单")>=0 })')
  console.log('ROUTE_WO_REPORT ' + r2)
  if (JSON.parse(r2).hash !== '#/panelx/list/WO_REPORT') FAIL('WO_REPORT 路由未生效')

  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)))
  console.log('HTTP_4XX_5XX ' + JSON.stringify(Array.from(new Set(http5xx)).slice(0, 8)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  console.log(failed === 0 ? 'RESULT: PASS' : 'RESULT: FAIL-' + failed)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
