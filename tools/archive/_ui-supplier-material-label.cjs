/**
 * _ui-supplier-material-label.cjs — 界面确认:供应商点「打印材料码」会弹窗(与采购订单一致)(2026-10-29)
 *
 * 用户报障:「供应商登录打印材料码时,直接就显示打印成功了,没有和采购订单一样有弹窗。这是一个错误」
 * 本脚本用真实浏览器登录供应商 → 打开「供应商采购打印」→ 展开「打印」组 → 点「打印材料码」,
 * 断言**弹窗出现**(标题含「打印材料码」、有批次号输入框、有行表),并截图。
 *
 * 用法:node tools/archive/_ui-supplier-material-label.cjs [baseUrl] [user] [pass]
 */
const fs = require('fs')
const path = require('path')
const http = require('http')
const os = require('os')
const { spawn } = require('child_process')
const { killTree } = require(path.join(__dirname, '..', 'verify', 'lib', 'kill-tree.cjs'))
const { closeBrowser, killHeadlessEdge } = require(path.join(__dirname, '..', 'verify', 'lib', 'browser-close.cjs'))

const CDP_PORT = 9500 + Math.floor(Math.random() * 400)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/?$/, '/')
const SUP_U = process.argv[3] || 'kbl01'
const SUP_P = process.argv[4] || 'kbl@2026'
const OUT_JSON = path.join(__dirname, '_ui-material-label.json')
const OUT_PNG = path.join(__dirname, '_ui-material-label.png')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail: detail ?? '' })
  console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`)
}
function httpJson(port, p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port, path: p }, (r) => {
      let d = ''
      r.on('data', (c) => (d += c))
      r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } })
    }).on('error', rej)
  })
}

async function main() {
  const proc = spawn(EDGE, [`--remote-debugging-port=${CDP_PORT}`, '--headless=new', '--disable-gpu',
    '--window-size=1680,1050', '--user-data-dir=' + path.join(os.tmpdir(), '_ui_material_label'), 'about:blank'],
  { stdio: 'ignore', detached: true })
  proc.unref()
  await sleep(4000)
  let list = null
  for (let i = 0; i < 40; i++) {
    try { const l = await httpJson(CDP_PORT, '/json/list'); if (Array.isArray(l) && l.length) { list = l; break } } catch (e) { /* 还没起来 */ }
    await sleep(500)
  }
  if (!list) throw new Error('调试端口 ' + CDP_PORT + ' 上没等到浏览器')
  const target = list.find((t) => t.type === 'page')
  const { connect } = require(path.join(__dirname, '..', 'verify', 'lib', 'mini-ws.cjs'))
  let id = 0
  const pending = new Map()
  const sock = await connect(target.webSocketDebuggerUrl)
  const logs = []
  sock.on('message', (d) => {
    const m = JSON.parse(d)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') logs.push('[EXC] ' + JSON.stringify(m.params.exceptionDetails).slice(0, 260))
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type !== 'log') logs.push('[console] ' + (m.params.args||[]).map(a=>a.value??a.description??'').join(' ').slice(0,200))
    if (m.method === 'Network.responseReceived' && m.params.response.url.includes('/api/')) logs.push('[' + m.params.response.status + '] ' + m.params.response.url.replace(BASE, '/').slice(0, 90))
  })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300))
    return r.result?.result?.value
  }
  await send('Page.enable')
  await send('Network.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1050, deviceScaleFactor: 1, mobile: false })

  try {
    const lj = await (await fetch(BASE + 'api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: SUP_U, password: SUP_P, factory: 'YJ' }),
    })).json()
    if (!lj.data?.token) throw new Error('供应商账号登录失败')
    await send('Page.navigate', { url: BASE + '#/login' })
    await sleep(2500)
    await evaluate(`localStorage.clear()`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)})`)
    await evaluate(`localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user))})`)
    await send('Page.navigate', { url: BASE + '?t=' + Date.now() + '#/scm/supplierPrint' })
    await sleep(2500)
    await send('Page.reload', {})
    await sleep(11000)

    // 展开「打印」组下拉,点「打印材料码」
    const opened = await evaluate(`(function(){
      var grp = Array.from(document.querySelectorAll('.tb-group')).find(function(g){
        var n = g.querySelector('.act-name'); return n && (n.innerText||'').replace(/\\s+/g,'') === '打印';
      });
      if (!grp) return 'no-print-group';
      var caret = grp.querySelector('.tb-caret');
      if (caret) caret.click();
      return new Promise(function(res){
        setTimeout(function(){
          var all = Array.from(document.querySelectorAll('.tb-menu .ctx-item'));
          window.__items = all.map(function(x){ return JSON.stringify(x.innerText||''); });
          var it = all.find(function(x){ return (x.innerText||'').trim() === '打印材料码'; });
          if (!it) return res('no-item:' + Array.from(document.querySelectorAll('.tb-menu .ctx-item')).map(function(x){return x.innerText}).join('|'));
          it.click();
          res('clicked');
        }, 600);
      });
    })()`)
    console.log('点「打印材料码」:', opened)
    console.log('下拉项原文(含空白/字符):', await evaluate('JSON.stringify(window.__items)'))
    check('工具栏「打印」组里有「打印材料码」', opened === 'clicked', String(opened))
    await sleep(4000)

    const dlg = await evaluate(`(function(){
      var ds = Array.from(document.querySelectorAll('.el-dialog'));
      var hit = ds.find(function(d){ var t=(d.innerText||''); return t.indexOf('打印材料码') >= 0; });
      if (!hit) return JSON.stringify({ open: false, dialogs: ds.map(function(d){ return (d.innerText||'').replace(/\\s+/g,' ').slice(0,40); }) });
      var inputs = Array.from(hit.querySelectorAll('input')).map(function(i){ return { ph: i.placeholder||'', v: i.value||'' }; });
      var rows = hit.querySelectorAll('.el-table__body tr').length;
      return JSON.stringify({ open: true, title: (hit.querySelector('.el-dialog__title')||{}).innerText||'', inputs: inputs.slice(0,6), rows: rows });
    })()`)
    console.log('弹窗状态:', dlg)
    const d = JSON.parse(dlg)
    check('★ 点「打印材料码」弹出了弹窗(不再是直接提示成功)', d.open === true, d.open ? d.title : JSON.stringify(d.dialogs))
    check('弹窗标题是「打印材料码」', String(d.title || '').indexOf('打印材料码') >= 0, String(d.title || ''))
    check('弹窗有批次号输入框(可填/可改)', (d.inputs || []).some((i) => String(i.ph).indexOf('批次') >= 0 || String(i.v).length >= 6), JSON.stringify((d.inputs || []).slice(0, 3)))
    check('弹窗列出了订单行(可勾选打印)', Number(d.rows) > 0, `${d.rows} 行`)

    console.log('--- 期间日志(最后 12 条) ---')
    console.log(logs.slice(-12).join('\n'))
    console.log('--- 日志 ---'); console.log(logs.filter(function(x){return x.indexOf('puLabel')>=0 || x.indexOf('EXC')>=0}).slice(-10).join('\n') || '(无 puLabel 请求/异常)')
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(OUT_PNG, Buffer.from(shot.result.data, 'base64'))

    const pass = results.filter((r) => r.ok).length
    console.log(`\n=== 结果: ${pass}/${results.length} 通过 ===`)
    fs.writeFileSync(OUT_JSON, JSON.stringify({ pass, total: results.length, items: results }, null, 2), 'utf8')
    process.exitCode = pass === results.length ? 0 : 1
  } finally {
    await closeBrowser(CDP_PORT)
    killTree(proc.pid)
    killHeadlessEdge('_ui_material_label')
  }
}
main().catch((e) => {
  console.error('[FATAL]', e)
  try { killHeadlessEdge('_ui_material_label') } catch (e2) { /* ignore */ }
  try { fs.writeFileSync(OUT_JSON, JSON.stringify({ error: String(e && e.stack || e), items: results }, null, 2), 'utf8') } catch (e3) { /* ignore */ }
  process.exitCode = 2
})
