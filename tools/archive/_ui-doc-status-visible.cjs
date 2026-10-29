/**
 * _ui-doc-status-visible.cjs — 界面确认:供应商采购打印的「审核状态」与条数和采购订单一致(2026-10-25)
 *
 * 用户报障现场:采购订单 2244 张、状态「已审核」;供应商采购打印 2245 张、状态全是「草稿」。
 * 本脚本只盯这两点(左栏「审核状态」列 + 总数),结果**写文件**(不靠 stdout,避免管道截断)。
 *
 * 用法:node tools/archive/_ui-doc-status-visible.cjs [baseUrl] [supplierUser] [supplierPass]
 */
const fs = require('fs')
const path = require('path')
const http = require('http')
const os = require('os')
const { spawn } = require('child_process')
const { killTree } = require(path.join(__dirname, '..', 'verify', 'lib', 'kill-tree.cjs'))
const { closeBrowser, killHeadlessEdge } = require(path.join(__dirname, '..', 'verify', 'lib', 'browser-close.cjs'))

// 端口随机:固定端口会与并行会话/残留实例撞车(撞上后 /json/list 永远连不上,脚本静默退出)
const CDP_PORT = 9500 + Math.floor(Math.random() * 400)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/?$/, '/')
const SUP_U = process.argv[3] || 'kbl01'
const SUP_P = process.argv[4] || 'kbl@2026'
const OUT = path.join(__dirname, '_doc-status-visible.json')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function httpJson(p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => {
      let d = ''
      r.on('data', (c) => (d += c))
      r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } })
    }).on('error', rej)
  })
}

const log = []
const say = (s) => { log.push(s); console.log(s) }

async function main() {
  const proc = spawn(EDGE, [`--remote-debugging-port=${CDP_PORT}`, '--headless=new', '--disable-gpu',
    '--window-size=1680,1050', '--user-data-dir=' + path.join(os.tmpdir(), '_ui_docstatus'), 'about:blank'],
  { stdio: 'ignore', detached: true })
  proc.unref()
  await sleep(4000)
  let list = null
  // 启动可能慢(冷启动 Edge 首次运行要 5~15s):给足 40 次 × 500ms,连不上就明确报错而不是静默
  for (let i = 0; i < 40; i++) {
    try { const l = await httpJson('/json/list'); if (Array.isArray(l) && l.length) { list = l; break } } catch (e) { /* 还没起来 */ }
    await sleep(500)
  }
  if (!list) throw new Error('调试端口 ' + CDP_PORT + ' 上没等到浏览器(/json/list 一直不可用)')
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

  const login = async (u, p) => {
    const r = await fetch(BASE + 'api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: u, password: p, factory: 'YJ' }),
    })
    return JSON.parse(await r.text())
  }
  const open = async (u, p, hash) => {
    const j = await login(u, p)
    await send('Page.navigate', { url: BASE + '#/login' })
    await sleep(2200)
    await evaluate(`localStorage.clear()`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(j.data.token)})`)
    await evaluate(`localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(j.data.user))})`)
    await send('Page.navigate', { url: BASE + '?t=' + Date.now() + hash })
    await sleep(2500)
    await send('Page.reload', {})
    await sleep(11000)
    return evaluate(`(function(){
      var t = (document.body.innerText || '').replace(/\\s+/g, ' ');
      // 左栏「审核状态」列:取左栏表格第 4 列的文本(单号/日期/供应商/审核状态)
      var railRows = Array.from(document.querySelectorAll('.doc-rail-layout table tr')).slice(1, 9);
      var statuses = railRows.map(function(tr){
        var tds = tr.querySelectorAll('td');
        return tds.length >= 4 ? (tds[3].innerText||'').trim() : '';
      }).filter(Boolean);
      return JSON.stringify({
        total: (t.match(/共有数据:\\s*(\\d+)\\s*条/) || [])[1] || '',
        pageTotal: (t.match(/第\\s*1\\/(\\d+)\\s*张/) || [])[1] || '',
        statuses: statuses,
        hash: location.hash,
      });
    })()`)
  }

  try {
    const pu = JSON.parse(await open('admin', '123456', '#/panelx/list/PU_ORDER'))
    say('采购订单:  总数=' + pu.total + '  第1/N张=' + pu.pageTotal + '  左栏状态=' + JSON.stringify(pu.statuses))
    const sp = JSON.parse(await open(SUP_U, SUP_P, '#/scm/supplierPrint'))
    say('供应商打印:总数=' + sp.total + '  第1/N张=' + sp.pageTotal + '  左栏状态=' + JSON.stringify(sp.statuses))
    // 同一面板用**管理员**身份再开一次:这才是"同一批数据"的对比(供应商账号本来就只看自己那 74 张)
    const adm = JSON.parse(await open('admin', '123456', '#/scm/supplierPrint'))
    say('供应商打印(管理员):总数=' + adm.total + '  第1/N张=' + adm.pageTotal + '  左栏状态=' + JSON.stringify(adm.statuses))

    const r = []
    r.push({ name: '采购订单左栏状态含「已审核」(基线)', ok: pu.statuses.includes('已审核'), detail: pu.statuses.join(',') })
    r.push({ name: '供应商打印左栏状态**不再是**「草稿」', ok: sp.statuses.length > 0 && !sp.statuses.every((s) => s === '草稿'), detail: sp.statuses.join(',') })
    r.push({ name: '供应商打印左栏状态含「已审核」', ok: sp.statuses.includes('已审核'), detail: sp.statuses.join(',') })
    r.push({ name: '管理员视角下两面板总数一致(删除的已同步排除)', ok: !!pu.total && pu.total === adm.total, detail: '采购订单 ' + pu.total + ' / 供应商(管理员) ' + adm.total })
    r.push({ name: '供应商账号只看到自己那部分(远小于全量)', ok: Number(sp.total) > 0 && Number(sp.total) < Number(adm.total), detail: '供应商 ' + sp.total + ' / 全量 ' + adm.total })
    const pass = r.filter((x) => x.ok).length
    r.forEach((x) => say(`  ${x.ok ? '[PASS]' : '[FAIL]'} ${x.name} — ${x.detail}`))
    say(`=== 结果: ${pass}/${r.length} 通过 ===`)
    fs.writeFileSync(OUT, JSON.stringify({ pass, total: r.length, items: r, raw: { pu, sp } }, null, 2), 'utf8')
    process.exitCode = pass === r.length ? 0 : 1
  } finally {
    await closeBrowser(CDP_PORT)
    killTree(proc.pid)
  killHeadlessEdge('_ui_docstatus')
  }
}
main().catch((e) => {
  say('[FATAL] ' + (e && e.message))
  try { fs.writeFileSync(OUT, JSON.stringify({ error: String(e && e.stack || e), log }, null, 2), 'utf8') } catch (e2) { /* ignore */ }
  process.exitCode = 2
})
