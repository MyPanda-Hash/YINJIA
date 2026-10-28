/**
 * _v-puorder-intact.cjs — 回归:采购订单原面板(PU_ORDER)按钮与左栏必须原样(2026-10-25)
 * 用途:确认新增「供应商采购打印」独立面板时**没有动到采购订单本身**。
 * 用法:node tools/archive/_v-puorder-intact.cjs [baseUrl]
 */
const CDP_PORT = 9406
const { spawn } = require('child_process')
const path = require('path')
const http = require('http')
const os = require('os')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/?$/, '/')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => {
      let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } })
    }).on('error', rej)
  })
}
const results = []
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail: detail ?? '' })
  console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`)
}
async function main() {
  const proc = spawn(EDGE, [`--remote-debugging-port=${CDP_PORT}`, '--headless=new', '--disable-gpu',
    '--window-size=1600,1000', '--user-data-dir=' + path.join(os.tmpdir(), '_pu_intact'), 'about:blank'],
  { stdio: 'ignore', detached: true })
  proc.unref()
  await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list && list.length) break } catch (e) {} await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require(path.join(__dirname, '..', 'verify', 'lib', 'mini-ws.cjs'))
  let id = 0; const pending = new Map()
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (data) => { const m = JSON.parse(data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300))
    return r.result?.result?.value
  }
  await send('Page.enable')
  const lj = await (await fetch(BASE + 'api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })).json()
  await send('Page.navigate', { url: BASE + '#/login' })
  await sleep(2500)
  await evaluate(`localStorage.clear()`)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)})`)
  await evaluate(`localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user))})`)
  await send('Page.navigate', { url: BASE + '?t=' + Date.now() + '#/panelx/list/PU_ORDER' })
  await sleep(2500)
  await send('Page.reload', {})
  await sleep(11000)
  // 查询一次把数据拉出来
  await evaluate(`(function(){ var b = Array.from(document.querySelectorAll('button')).find(function(x){ var t=(x.innerText||'').replace(/\\s+/g,''); return t==='查询'||t==='查找'; }); if (b) b.click(); })()`)
  await sleep(5000)
  const st = await evaluate(`(function(){
    var groups = Array.from(document.querySelectorAll('.tb-group')).map(function(g){ return (g.innerText||'').replace(/[▼\\s]/g,''); });
    var t = (document.body.innerText || '').replace(/\\s+/g, ' ');
    return JSON.stringify({ groups: groups, rail: t.indexOf('选择') >= 0, total: (t.match(/第\\s*1\\/(\\d+)\\s*张/) || [])[1] || '' });
  })()`)
  const s = JSON.parse(st)
  console.log('\n采购订单(PU_ORDER)工具栏:', s.groups.join(','))
  for (const g of ['新增', '保存', '删除', '审批', '生单', '打印', '导入', '更多']) {
    check(`采购订单仍有「${g}」组`, s.groups.includes(g))
  }
  check('采购订单有「单据选择」左栏', s.rail)
  check('采购订单看全量', Number(s.total) > 2000, `共 ${s.total} 张`)

  const pass = results.filter((r) => r.ok).length
  console.log(`\n=== 结果: ${pass}/${results.length} 通过 ===`)
  try { sock.close() } catch (e) {}
  try { process.kill(-proc.pid) } catch (e) {}
  process.exit(pass === results.length ? 0 : 1)
}
main().catch((e) => { console.error('[FATAL]', e); process.exit(2) })
