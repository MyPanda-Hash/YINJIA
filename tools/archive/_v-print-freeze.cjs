/**
 * _v-print-freeze.cjs — 复现/排查「供应商打印会卡死浏览器」(2026-10-29)
 *
 * 卡死的常见机理,本脚本逐条测量:
 *   ① 打印层 DOM 规模(#yj-print-host 里节点数 / html 长度)—— 几百个节点没问题,上万才卡;
 *   ② 二维码生成耗时(逐张 await toDataURL,串行);
 *   ③ window.print() 之后主线程是否被阻塞(用 rAF 心跳测:打印对话框在无头模式下会立刻返回);
 *   ④ 打印层是否被摘掉(没摘 = 后续每次打印都叠加一层,越打越卡);
 *   ⑤ 是否有大循环/死循环(CPU 时间)。
 *
 * 用法:node tools/archive/_v-print-freeze.cjs [baseUrl] [user] [pass]
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
const OUT = path.join(__dirname, '_print-freeze.json')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = []
const say = (s) => { log.push(s); console.log(s) }

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
    '--window-size=1680,1050', '--user-data-dir=' + path.join(os.tmpdir(), '_print_freeze'), 'about:blank'],
  { stdio: 'ignore', detached: true })
  proc.unref()
  await sleep(4000)
  let list = null
  for (let i = 0; i < 40; i++) {
    try { const l = await httpJson(CDP_PORT, '/json/list'); if (Array.isArray(l) && l.length) { list = l; break } } catch (e) { /* wait */ }
    await sleep(500)
  }
  if (!list) throw new Error('调试端口没起来')
  const target = list.find((t) => t.type === 'page')
  const { connect } = require(path.join(__dirname, '..', 'verify', 'lib', 'mini-ws.cjs'))
  let id = 0
  const pending = new Map()
  const sock = await connect(target.webSocketDebuggerUrl)
  const net = []
  sock.on('message', (d) => {
    const m = JSON.parse(d)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') net.push('[EXC] ' + JSON.stringify(m.params.exceptionDetails).slice(0, 200))
    if (m.method === 'Network.responseReceived' && String(m.params.response.url).includes('/api/')) net.push('[' + m.params.response.status + '] ' + m.params.response.url.replace(BASE, '/').slice(0, 70))
  })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const evaluate = async (expr, timeoutHint) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error('EVAL(' + (timeoutHint || '') + '): ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300))
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
    if (!lj.data?.token) throw new Error('供应商登录失败')
    await send('Page.navigate', { url: BASE + '#/login' })
    await sleep(2500)
    await evaluate(`localStorage.clear()`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)})`)
    await evaluate(`localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user))})`)
    await send('Page.navigate', { url: BASE + '?t=' + Date.now() + '#/scm/supplierPrint' })
    await sleep(2500)
    await send('Page.reload', {})
    await sleep(11000)

    // 监控主线程健康:每 100ms 记一次 rAF 间隔
    await evaluate(`(function(){
      window.__hb = { last: performance.now(), maxGap: 0, ticks: 0 };
      function tick(){ var n = performance.now(); var g = n - window.__hb.last; if (g > window.__hb.maxGap) window.__hb.maxGap = g; window.__hb.last = n; window.__hb.ticks++; requestAnimationFrame(tick); }
      requestAnimationFrame(tick);
      // 统计 window.print 被调用次数(无头下会立刻返回,不会真弹对话框)
      window.__printCalls = 0;
      var origPrint = window.print;
      window.print = function(){ window.__printCalls++; try { return origPrint.apply(window, arguments) } catch(e) { return undefined } };
    })()`)

    // ---------- A. 打印材料码(弹窗确认打印) ----------
    say('\n== A. 打印材料码 ==')
    const opened = await evaluate(`(function(){
      var grp = Array.from(document.querySelectorAll('.tb-group')).find(function(g){
        var n = g.querySelector('.act-name'); return n && (n.innerText||'').replace(/\\s+/g,'') === '打印';
      });
      if (!grp) return 'no-group';
      var caret = grp.querySelector('.tb-caret'); if (caret) caret.click();
      return new Promise(function(res){
        setTimeout(function(){
          var it = Array.from(document.querySelectorAll('.tb-menu .ctx-item')).find(function(x){ return (x.innerText||'').trim() === '打印材料码'; });
          if (!it) return res('no-item');
          it.click(); res('clicked');
        }, 600);
      });
    })()`)
    say('  打开材料码弹窗: ' + opened)
    await sleep(3000)

    // 看弹窗默认勾了几行、预填多少数量
    const dlgInfo = await evaluate(`(function(){
      var dlg = Array.from(document.querySelectorAll('.el-dialog')).find(function(d){ return (d.innerText||'').indexOf('打印材料码') >= 0; });
      if (!dlg) return JSON.stringify({ open:false });
      var checked = dlg.querySelectorAll('.el-table__body .el-checkbox.is-checked').length;
      var rows = dlg.querySelectorAll('.el-table__body tr').length;
      var qtys = Array.from(dlg.querySelectorAll('.el-table__body input')).map(function(i){ return i.value; }).filter(function(v){ return v && Number(v) > 0; });
      return JSON.stringify({ open:true, rows:rows, checked:checked, qtyCount:qtys.length, qtySample:qtys.slice(0,8) });
    })()`)
    say('  弹窗: ' + dlgInfo)

    // 点「确认打印」
    const beforePrint = await evaluate(`JSON.stringify({ nodes: document.getElementsByTagName('*').length, calls: window.__printCalls })`)
    const t0 = Date.now()
    const clicked = await evaluate(`(function(){
      var dlg = Array.from(document.querySelectorAll('.el-dialog')).find(function(d){ return (d.innerText||'').indexOf('打印材料码') >= 0; });
      if (!dlg) return 'no-dialog';
      var btns = Array.from(dlg.querySelectorAll('button'));
      var b = btns.find(function(x){ var t=(x.innerText||'').trim(); return t.indexOf('确认打印')>=0 || t.indexOf('打印')>=0 && t.indexOf('取消')<0; });
      if (!b) return 'no-button:' + btns.map(function(x){return (x.innerText||'').trim()}).join('|');
      b.click(); return 'clicked:' + (b.innerText||'').trim();
    })()`)
    say('  点确认打印: ' + clicked + ' (耗时 ' + (Date.now() - t0) + 'ms)')

    // 轮询主线程是否被阻塞 + 打印层规模
    let worstGap = 0
    let hostInfo = ''
    for (let i = 0; i < 40; i++) {
      await sleep(500)
      try {
        const st = await evaluate(`JSON.stringify({
          gap: window.__hb.maxGap, ticks: window.__hb.ticks, calls: window.__printCalls,
          nodes: document.getElementsByTagName('*').length,
          host: (function(){ var h=document.getElementById('yj-print-host'); return h ? { nodes: h.getElementsByTagName('*').length, htmlLen: h.innerHTML.length } : null })()
        })`)
        const s = JSON.parse(st)
        if (s.gap > worstGap) worstGap = s.gap
        if (s.host) hostInfo = `打印层节点=${s.host.nodes} html=${s.host.htmlLen}`
        if (s.calls > 0 && i > 6) break
      } catch (e) {
        say('  ⚠ 页面无响应(评估超时): ' + String(e.message).slice(0, 120))
        break
      }
    }
    const afterPrint = await evaluate(`JSON.stringify({
      nodes: document.getElementsByTagName('*').length, calls: window.__printCalls,
      host: !!document.getElementById('yj-print-host'), gap: window.__hb.maxGap
    })`).catch(() => '{"error":"页面无响应"}')
    say('  打印前: ' + beforePrint)
    say('  打印后: ' + afterPrint)
    say('  主线程最大卡顿: ' + Math.round(worstGap) + 'ms   ' + hostInfo)

    // ---------- B. 纸质单(打印采购订单) ----------
    say('\n== B. 打印采购订单(纸质单) ==')
    await evaluate(`(function(){
      var dlg = Array.from(document.querySelectorAll('.el-dialog')).find(function(d){ return (d.innerText||'').indexOf('打印材料码') >= 0; });
      if (dlg) { var x = dlg.querySelector('.el-dialog__headerbtn'); if (x) x.click(); }
      var grp = Array.from(document.querySelectorAll('.tb-group')).find(function(g){
        var n = g.querySelector('.act-name'); return n && (n.innerText||'').replace(/\\s+/g,'') === '打印';
      });
      if (grp) { var m = grp.querySelector('.tb-main'); if (m) m.click(); }
    })()`)
    await sleep(6000)
    const afterPaper = await evaluate(`JSON.stringify({
      calls: window.__printCalls, gap: window.__hb.maxGap,
      nodes: document.getElementsByTagName('*').length,
      host: !!document.getElementById('yj-print-host')
    })`).catch(() => '{"error":"页面无响应"}')
    say('  纸质单打印后: ' + afterPaper)

    // ---------- C. 结论 ----------
    const last = JSON.parse(afterPaper.startsWith('{') ? afterPaper : '{}')
    say('\n== 判定 ==')
    say('  window.print 调用次数 = ' + (last.calls ?? '?'))
    say('  主线程最大卡顿 = ' + Math.round(last.gap ?? 0) + 'ms  (>1000ms 才算"卡")')
    say('  打印层是否残留 = ' + (last.host ? '是(没摘掉 → 会越打越卡)' : '否'))
    say('  典型响应日志: ' + net.filter((x) => x.includes('puLabel') || x.includes('EXC')).slice(-5).join(' | '))

    fs.writeFileSync(OUT, JSON.stringify({ beforePrint, afterPrint, afterPaper, worstGap, net: net.slice(-20), log }, null, 2), 'utf8')
    process.exitCode = 0
  } finally {
    await closeBrowser(CDP_PORT)
    killTree(proc.pid)
    killHeadlessEdge('_print_freeze')
  }
}
main().catch((e) => {
  say('[FATAL] ' + (e && e.message))
  try { killHeadlessEdge('_print_freeze') } catch (e2) { /* ignore */ }
  try { fs.writeFileSync(OUT, JSON.stringify({ error: String(e && e.stack || e), log }, null, 2), 'utf8') } catch (e3) { /* ignore */ }
  process.exitCode = 2
})
