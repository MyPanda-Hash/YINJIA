/**
 * _ui-supplier-po-panel.cjs — 「供应商采购打印」独立面板界面验证(2026-10-25)
 *
 * ① 供应商登录 → 菜单里只有「供应商采购打印」一条；
 * ② 点进去就是采购订单那套版面(左栏单据选择 + 明细表),工具栏**只有 查询 + 打印**；
 * ③ 列表只出本供应商的 74 单;
 * ④ 点「打印」出的是与采购订单同一张纸质单(银嘉采购订单);
 * ⑤ 内部账号(admin)打开同一面板:同样只有 查询 + 打印,但看到全量 2245 单。
 *
 * 用法:node tools/archive/_ui-supplier-po-panel.cjs [baseUrl] [supplierUser] [supplierPass]
 */
const CDP_PORT = 9397
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')
const os = require('os')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/?$/, '/')
const SU = process.argv[3] || 'kbl01'
const SP = process.argv[4] || 'kbl@2026'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail: detail ?? '' })
  console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`)
}
function httpJson(p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => {
      let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } })
    }).on('error', rej)
  })
}
async function main() {
  const proc = spawn(EDGE, [`--remote-debugging-port=${CDP_PORT}`, '--headless=new', '--disable-gpu',
    '--window-size=1600,1000', '--user-data-dir=' + path.join(os.tmpdir(), '_po_panel'), 'about:blank'],
  { stdio: 'ignore', detached: true })
  proc.unref()
  await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list && list.length) break } catch (e) {} await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require(path.join(__dirname, '..', 'verify', 'lib', 'mini-ws.cjs'))
  const { killTree } = require(path.join(__dirname, '..', 'verify', 'lib', 'kill-tree.cjs'))
  const { closeBrowser } = require(path.join(__dirname, '..', 'verify', 'lib', 'browser-close.cjs'))
  let id = 0; const pending = new Map()
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (data) => { const m = JSON.parse(data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400))
    return r.result?.result?.value
  }
  const shot = async (n) => {
    const s = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(__dirname, `_pop-${n}.png`), Buffer.from(s.result.data, 'base64'))
  }
  const apiLogin = async (u, p) => (await fetch(BASE + 'api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: u, password: p, factory: 'YJ' }),
  })).json()
  const useSession = async (lj) => {
    await evaluate(`localStorage.clear()`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)})`)
    await evaluate(`localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user))})`)
  }
  const goto = async (hash) => {
    await send('Page.navigate', { url: BASE + '?t=' + Date.now() + hash })
    await sleep(2500)
    await send('Page.reload', {})
    await sleep(9500)
  }
  await send('Page.enable')
  await goto('#/login')

  // ---------- 供应商 ----------
  console.log('\n== ① 供应商登录:菜单只剩一条 ==')
  await useSession(await apiLogin(SU, SP))
  await goto('#/scm/supplierPrint')
  const sup = await evaluate(`(function(){
    var t = (document.body.innerText || '').replace(/\\s+/g, ' ');
    var groups = Array.from(document.querySelectorAll('.tb-group')).map(function(g){ return (g.innerText||'').replace(/[▼\\s]/g,''); });
    var nav = Array.from(document.querySelectorAll('.mn-item, .el-menu-item, [class*="nav"]')).map(function(x){ return (x.innerText||'').replace(/\\s+/g,'').trim(); }).filter(Boolean);
    return JSON.stringify({
      hash: location.hash,
      groups: groups,
      hasRail: t.indexOf('选择') >= 0 || !!document.querySelector('.doc-rail-layout'),
      total: (t.match(/共\\s*有?\\s*数据[:：]?\\s*(\\d+)/) || t.match(/第\\s*1\\/(\\d+)\\s*张/) || [])[1] || '',
      hasDetail: t.indexOf('物料编码') >= 0,
      hasQueryBtn: !!document.querySelector('.toolbar-query-btn'),
      supplierBar: !!document.querySelector('.portal-supplier-bar'),
      navText: nav.slice(0, 10),
    });
  })()`)
  const s = JSON.parse(sup)
  check('地址 = 供应商采购打印', s.hash.includes('/scm/supplierPrint'), s.hash)
  // 工具栏 = 常驻「查询」按钮 + 「打印」组(用户口径「只有打印按钮和查询按钮」)
  check('工具栏只有 查询 + 打印', s.hasQueryBtn && JSON.stringify(s.groups) === JSON.stringify(['打印']),
    `常驻查询=${s.hasQueryBtn} 组=${s.groups.join(',')}`)
  check('有单据选择左栏(采购订单版式)', s.hasRail)
  check('有明细表(物料编码等列)', s.hasDetail)
  check('数据只有本供应商(74 张)', s.total === '74', `共 ${s.total} 张`)
  check('仍是供应商门户壳(无侧栏/页签)', s.supplierBar)
  await shot('supplier')

  // ---------- 打印 ----------
  console.log('\n== ② 打印:与采购订单同一张纸质单 ==')
  const printed = await evaluate(`(function(){
    return new Promise(function(resolve){
      var orig = window.open; var opened = null;
      window.open = function(u, n, f){ var w = orig.call(window, '', n, f); if (w) opened = w; return w; };
      // 主按钮 = 「打印」组的 .tb-main(工具栏组是 span.tb-main,不是 <button>)
      var grp = Array.from(document.querySelectorAll('.tb-group')).find(function(g){
        var n = g.querySelector('.act-name');
        return n && (n.innerText||'').replace(/\\s+/g,'') === '打印';
      });
      var btn = grp && grp.querySelector('.tb-main');
      if (!btn) { window.open = orig; resolve(JSON.stringify({ why: 'no-print-button' })); return; }
      btn.click();
      setTimeout(function(){
        window.open = orig;
        var text = '';
        try { text = opened && opened.document ? (opened.document.body.innerText||'').replace(/\\s+/g,' ') : ''; } catch (e) { text = 'ERR ' + e.message; }
        resolve(JSON.stringify({ opened: !!opened, text: text.slice(0, 200) }));
      }, 4500);
    });
  })()`)
  const pr = JSON.parse(printed)
  check('点打印打开了纸质单窗口', pr.opened, JSON.stringify(pr).slice(0, 120))
  check('纸质单是「银嘉采购订单」(与采购订单同版式)', String(pr.text || '').includes('银嘉采购订单'), String(pr.text || '').slice(0, 100))
  check('纸质单是本供应商的单号', String(pr.text || '').includes('YJ-'), String(pr.text || '').slice(0, 80))

  // ---------- 内部账号 ----------
  console.log('\n== ③ 内部账号:同一面板、全量、同样只读 ==')
  await useSession(await apiLogin('admin', '123456'))
  await goto('#/scm/supplierPrint')
  const adm = await evaluate(`(function(){
    var t = (document.body.innerText || '').replace(/\\s+/g, ' ');
    var groups = Array.from(document.querySelectorAll('.tb-group')).map(function(g){ return (g.innerText||'').replace(/[▼\\s]/g,''); });
    return JSON.stringify({ hash: location.hash, groups: groups, hasQueryBtn: !!document.querySelector('.toolbar-query-btn'), total: (t.match(/第\\s*1\\/(\\d+)\\s*张/) || [])[1] || '' });
  })()`)
  const a = JSON.parse(adm)
  check('内部账号能打开同一面板', a.hash.includes('/scm/supplierPrint'), a.hash)
  check('内部账号工具栏同样只有 查询 + 打印',
    a.hasQueryBtn && JSON.stringify(a.groups) === JSON.stringify(['打印']),
    `常驻查询=${a.hasQueryBtn} 组=${(a.groups || []).join(',')}`)
  check('内部账号看到全量(2245 张)', a.total === '2245', `共 ${a.total} 张`)
  await shot('admin')

  const pass = results.filter((r) => r.ok).length
  console.log(`\n=== 结果: ${pass}/${results.length} 通过 ===`)
  try { sock.close() } catch (e) {}
  await closeBrowser(CDP_PORT)
  killTree(proc.pid)
  process.exit(pass === results.length ? 0 : 1)
}
main().catch((e) => { console.error('[FATAL]', e); process.exit(2) })
