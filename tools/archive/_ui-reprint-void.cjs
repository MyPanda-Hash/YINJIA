/**
 * _ui-reprint-void.cjs — 界面确认:供应商弹窗里「重打 / 作废」真的生效(2026-10-29)
 *
 * 用户报障:「作废显示成功,时间没有变化,重打就是报错 undefined」。
 * 本脚本用真实浏览器:登录供应商 → 打开材料码弹窗 → 先打一次拿到记录 →
 * 点「重打」看提示是否正常(不再 undefined)→ 点「作废」看记录是否消失。
 *
 * 用法:node tools/archive/_ui-reprint-void.cjs [baseUrl]
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
const OUT = path.join(__dirname, '_ui-reprint-void.json')
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
    '--window-size=1680,1050', '--user-data-dir=' + path.join(os.tmpdir(), '_ui_rv'), 'about:blank'],
  { stdio: 'ignore', detached: true })
  proc.unref()
  await sleep(4000)
  let list = null
  for (let i = 0; i < 40; i++) {
    try { const l = await httpJson(CDP_PORT, '/json/list'); if (Array.isArray(l) && l.length) { list = l; break } } catch (e) { /* wait */ }
    await sleep(500)
  }
  if (!list) throw new Error('浏览器没起来')
  const target = list.find((t) => t.type === 'page')
  const { connect } = require(path.join(__dirname, '..', 'verify', 'lib', 'mini-ws.cjs'))
  let id = 0
  const pending = new Map()
  const sock = await connect(target.webSocketDebuggerUrl)
  const net = []
  sock.on('message', (d) => {
    const m = JSON.parse(d)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    if (m.method === 'Network.responseReceived') {
      const u = String(m.params.response.url)
      if (u.indexOf('/api/px/puLabel') >= 0) net.push('[' + m.params.response.status + '] ' + u.replace(BASE, '/').slice(0, 60))
    }
  })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300))
    return r.result?.result?.value
  }
  await send('Page.enable')
  await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1050, deviceScaleFactor: 1, mobile: false })

  try {
    const lj = await (await fetch(BASE + 'api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: SUP_U, password: SUP_P, factory: 'YJ' }),
    })).json()
    await send('Page.navigate', { url: BASE + '#/login' })
    await sleep(2500)
    await evaluate(`localStorage.clear()`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)})`)
    await evaluate(`localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user))})`)
    await send('Page.navigate', { url: BASE + '?t=' + Date.now() + '#/scm/supplierPrint' })
    await sleep(2500)
    await send('Page.reload', {})
    await sleep(11000)

    // 打开材料码弹窗
    await evaluate(`(function(){
      var grp = Array.from(document.querySelectorAll('.tb-group')).find(function(g){
        var n = g.querySelector('.act-name'); return n && (n.innerText||'').replace(/\\s+/g,'') === '打印';
      });
      if (!grp) return false;
      var c = grp.querySelector('.tb-caret'); if (c) c.click();
      return new Promise(function(res){
        setTimeout(function(){
          var it = Array.from(document.querySelectorAll('.tb-menu .ctx-item')).find(function(x){ return (x.innerText||'').trim() === '打印材料码'; });
          if (it) it.click();
          res(!!it);
        }, 600);
      });
    })()`)
    await sleep(3500)

    // 勾一行、填数量 1、点确定并打印 → 产生一条记录
    await evaluate(`(function(){
      var dlg = Array.from(document.querySelectorAll('.el-dialog')).find(function(d){ return (d.innerText||'').indexOf('打印材料码') >= 0; });
      if (!dlg) return false;
      var rows = Array.from(dlg.querySelectorAll('.el-table__body tr'));
      for (var i = 0; i < rows.length; i++) {
        var td = rows[i].querySelectorAll('td');
        if (td.length > 7) {
          var capCell = (td[7].innerText||'').trim();
          if (Number(capCell) > 0) {
            var cb = td[0].querySelector('.el-checkbox'); if (cb) cb.click();
            var inp = rows[i].querySelector('input.el-input__inner') || rows[i].querySelector('input');
            if (inp) {
              var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              setter.call(inp, '1');
              inp.dispatchEvent(new Event('input', { bubbles: true }));
            }
            break;
          }
        }
      }
      return true;
    })()`)
    await sleep(800)
    await evaluate(`(function(){
      var dlg = Array.from(document.querySelectorAll('.el-dialog')).find(function(d){ return (d.innerText||'').indexOf('打印材料码') >= 0; });
      if (!dlg) return false;
      var b = Array.from(dlg.querySelectorAll('button')).find(function(x){ return (x.innerText||'').indexOf('确定并打印') >= 0; });
      if (b) b.click();
      return !!b;
    })()`)
    await sleep(5000)

    // 读「已打印记录」表:取第一行的批次号 + 打印单号
    const recBefore = await evaluate(`(function(){
      var dlg = Array.from(document.querySelectorAll('.el-dialog')).find(function(d){ return (d.innerText||'').indexOf('打印材料码') >= 0; });
      if (!dlg) return JSON.stringify({ ok:false });
      var tables = Array.from(dlg.querySelectorAll('.el-table'));
      var recTable = tables[tables.length - 1];
      var rows = Array.from(recTable.querySelectorAll('.el-table__body tr'));
      var first = rows[0];
      if (!first) return JSON.stringify({ ok:false, rows:0 });
      var tds = Array.from(first.querySelectorAll('td')).map(function(x){ return (x.innerText||'').trim(); });
      return JSON.stringify({ ok:true, rows:rows.length, cells:tds.slice(0,6) });
    })()`)
    console.log('已打印记录(打印后):', recBefore)
    const rb = JSON.parse(recBefore)
    check('打印后「已打印记录」出现新行', rb.ok && rb.rows > 0, JSON.stringify(rb.cells || []))

    // 点「重打」,看提示内容(不能是 undefined)
    await evaluate(`(function(){
      var dlg = Array.from(document.querySelectorAll('.el-dialog')).find(function(d){ return (d.innerText||'').indexOf('打印材料码') >= 0; });
      var tables = Array.from(dlg.querySelectorAll('.el-table'));
      var recTable = tables[tables.length - 1];
      var first = recTable.querySelector('.el-table__body tr');
      var b = first && Array.from(first.querySelectorAll('button, .el-button, span')).find(function(x){ return (x.innerText||'').trim() === '重打'; });
      if (b) b.click();
      return !!b;
    })()`)
    await sleep(4500)
    const msgReprint = await evaluate(`JSON.stringify(Array.from(document.querySelectorAll('.el-message')).map(function(m){ return (m.innerText||'').trim(); }))`)
    console.log('重打提示:', msgReprint)
    check('★ 重打提示不含 undefined', !String(msgReprint).includes('undefined'), String(msgReprint))
    check('重打提示是「已重打」', String(msgReprint).includes('已重打'), String(msgReprint))

    // 点「作废」并确认
    await evaluate(`(function(){
      var dlg = Array.from(document.querySelectorAll('.el-dialog')).find(function(d){ return (d.innerText||'').indexOf('打印材料码') >= 0; });
      var tables = Array.from(dlg.querySelectorAll('.el-table'));
      var recTable = tables[tables.length - 1];
      var first = recTable.querySelector('.el-table__body tr');
      var b = first && Array.from(first.querySelectorAll('button, .el-button, span')).find(function(x){ return (x.innerText||'').trim() === '作废'; });
      if (b) b.click();
      return !!b;
    })()`)
    await sleep(1500)
    await evaluate(`(function(){
      var box = document.querySelector('.el-message-box');
      if (!box) return false;
      var b = Array.from(box.querySelectorAll('button')).find(function(x){ var t=(x.innerText||'').trim(); return t === '确定' || t === 'OK'; });
      if (b) b.click();
      return !!b;
    })()`)
    await sleep(4000)

    const recAfter = await evaluate(`(function(){
      var dlg = Array.from(document.querySelectorAll('.el-dialog')).find(function(d){ return (d.innerText||'').indexOf('打印材料码') >= 0; });
      var tables = Array.from(dlg.querySelectorAll('.el-table'));
      var recTable = tables[tables.length - 1];
      var rows = Array.from(recTable.querySelectorAll('.el-table__body tr')).map(function(r){ return (r.innerText||'').replace(/\\s+/g,' ').trim().slice(0,40); });
      var msgs = Array.from(document.querySelectorAll('.el-message')).map(function(m){ return (m.innerText||'').trim(); });
      return JSON.stringify({ rows: rows, msgs: msgs });
    })()`)
    console.log('作废后:', recAfter)
    const ra = JSON.parse(recAfter)
    check('★ 作废后该记录从列表消失', !ra.rows.some((r) => String(r).includes(String(rb.cells?.[0] || '@@'))),
      `剩 ${ra.rows.length} 行`)
    check('作废提示正常', String(ra.msgs.join('|')).includes('作废'), String(ra.msgs.join('|')))

    console.log('--- puLabel 请求 ---')
    console.log(net.join('\n') || '(无)')
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(__dirname, '_ui-reprint-void.png'), Buffer.from(shot.result.data, 'base64'))

    const pass = results.filter((r) => r.ok).length
    console.log(`\n=== 结果: ${pass}/${results.length} 通过 ===`)
    fs.writeFileSync(OUT, JSON.stringify({ pass, total: results.length, items: results }, null, 2), 'utf8')
    process.exitCode = pass === results.length ? 0 : 1
  } finally {
    await closeBrowser(CDP_PORT)
    killTree(proc.pid)
    killHeadlessEdge('_ui_rv')
  }
}
main().catch((e) => {
  console.error('[FATAL]', e)
  try { killHeadlessEdge('_ui_rv') } catch (e2) { /* ignore */ }
  process.exitCode = 2
})
