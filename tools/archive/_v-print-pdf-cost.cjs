/**
 * _v-print-pdf-cost.cjs — 用 Chrome 的**打印布局引擎**(printToPDF)量三张单的打印耗时(2026-10-29)
 *
 * 用户:「打印会出现 Edge 无响应,要等较长时间」,截图标题是「银嘉采购订单(无金额)」。
 * 无头模式的 window.print() 会立刻返回、量不出真实卡顿;但 `Page.printToPDF` 走的是
 * **和打印预览同一套布局/光栅化**,能直接量出"浏览器要把这份文档排成纸"要多久。
 *
 * 输出:每种单据的打印层节点数 / HTML 大小 / printToPDF 耗时。
 * 用法:node tools/archive/_v-print-pdf-cost.cjs [baseUrl]
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
const OUT = path.join(__dirname, '_print-pdf-cost.json')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
    '--window-size=1680,1050', '--user-data-dir=' + path.join(os.tmpdir(), '_pdf_cost'), 'about:blank'],
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
  sock.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300))
    return r.result?.result?.value
  }

  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1050, deviceScaleFactor: 1, mobile: false })

  try {
    const lj = await (await fetch(BASE + 'api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'kbl01', password: 'kbl@2026', factory: 'YJ' }),
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

    // 先量"空白页"的 PDF 成本作为基线
    const baseline = Date.now()
    await send('Page.printToPDF', { printBackground: true })
    const baselineMs = Date.now() - baseline
    console.log(`基线(供应商页面,不含打印层) printToPDF = ${baselineMs}ms`)

    const measure = async (label, clickExpr) => {
      await evaluate(clickExpr)
      await sleep(3000)
      const info = await evaluate(`JSON.stringify((function(){
        var h = document.getElementById('yj-print-host');
        return h ? { nodes: h.getElementsByTagName('*').length, htmlLen: h.innerHTML.length, imgs: h.querySelectorAll('img').length } : null;
      })())`)
      const parsed = info && info !== 'null' ? JSON.parse(info) : null
      const t0 = Date.now()
      let pdfErr = ''
      try {
        await send('Page.printToPDF', { printBackground: true })
      } catch (e) {
        pdfErr = String(e && e.message || e).slice(0, 80)
      }
      const cost = Date.now() - t0
      console.log(`  ${label}: 打印层 ${parsed ? parsed.nodes + ' 节点/' + parsed.htmlLen + ' 字符/' + parsed.imgs + ' 图' : '(无)'} → printToPDF **${cost}ms**${pdfErr ? ' (err ' + pdfErr + ')' : ''}`)
      // 摘掉打印层,量下一张
      await evaluate(`(function(){ var h=document.getElementById('yj-print-host'); if(h) h.remove(); var c=document.getElementById('yj-print-host-css'); if(c) c.remove(); })()`)
      return { label, nodes: parsed?.nodes ?? 0, htmlLen: parsed?.htmlLen ?? 0, imgs: parsed?.imgs ?? 0, costMs: cost }
    }

    const rows = []
    // ① 纸质单(打印采购订单)
    rows.push(await measure('打印采购订单', `(function(){
      var grp = Array.from(document.querySelectorAll('.tb-group')).find(function(g){
        var n = g.querySelector('.act-name'); return n && (n.innerText||'').replace(/\\s+/g,'') === '打印';
      });
      if (grp) { var m = grp.querySelector('.tb-main'); if (m) m.click(); }
    })()`))
    // ② 无金额纸质单
    rows.push(await measure('打印订单无金额', `(function(){
      var grp = Array.from(document.querySelectorAll('.tb-group')).find(function(g){
        var n = g.querySelector('.act-name'); return n && (n.innerText||'').replace(/\\s+/g,'') === '打印';
      });
      if (!grp) return;
      var c = grp.querySelector('.tb-caret'); if (c) c.click();
      setTimeout(function(){
        var it = Array.from(document.querySelectorAll('.tb-menu .ctx-item')).find(function(x){ return (x.innerText||'').trim() === '打印订单无金额'; });
        if (it) it.click();
      }, 500);
    })()`))

    console.log('\n=== 汇总 ===')
    console.log(`基线(无打印层) ${baselineMs}ms`)
    rows.forEach((r) => console.log(`${r.label}: ${r.costMs}ms  (${r.nodes} 节点, ${r.htmlLen} 字符, ${r.imgs} 图)`))
    fs.writeFileSync(OUT, JSON.stringify({ baselineMs, rows }, null, 2), 'utf8')
    process.exitCode = 0
  } finally {
    await closeBrowser(CDP_PORT)
    killTree(proc.pid)
    killHeadlessEdge('_pdf_cost')
  }
}
main().catch((e) => {
  console.error('[FATAL]', e)
  try { killHeadlessEdge('_pdf_cost') } catch (e2) { /* ignore */ }
  process.exitCode = 2
})
