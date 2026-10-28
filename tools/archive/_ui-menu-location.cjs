/**
 * _ui-menu-location.cjs — 截图/读取侧栏飞出卡片,确认「供应商采购打印」位于 采购管理 → 供应商门户(2026-10-25)
 * 用法:node tools/archive/_ui-menu-location.cjs [baseUrl]
 */
const CDP_PORT = 9408
const { spawn } = require('child_process')
const fs = require('fs')
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
    '--window-size=1680,1100', '--user-data-dir=' + path.join(os.tmpdir(), '_menu_loc'), 'about:blank'],
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
    if (r.result?.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300))
    return r.result?.result?.value
  }
  await send('Page.enable')
  // 固定视口尺寸(避免被当成窄屏手机模式,侧栏收起)
  await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1050, deviceScaleFactor: 1, mobile: false })
  const lj = await (await fetch(BASE + 'api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })).json()
  await send('Page.navigate', { url: BASE + '#/login' })
  await sleep(2500)
  await evaluate(`localStorage.clear()`)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)})`)
  await evaluate(`localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user))})`)
  await send('Page.navigate', { url: BASE + '?t=' + Date.now() + '#/dashboard' })
  await sleep(3000)
  await send('Page.reload', {})
  await sleep(10000)

  const clickText = async (selector, text) => {
    const box = await evaluate(`(function(){
      var els = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
      var hit = els.find(function(e){ return (e.innerText||'').replace(/\\s+/g,'').indexOf(${JSON.stringify(text)}) === 0; });
      if (!hit) return null;
      var r = hit.getBoundingClientRect();
      return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) });
    })()`)
    if (!box) return false
    const b = JSON.parse(box)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y })
    await sleep(400)
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.x, y: b.y, button: 'left', buttons: 1, clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', buttons: 0, clickCount: 1 })
    return true
  }

  const okGroup = await clickText('.nav-group', '智能供应链')
  await sleep(1500)
  check('侧栏能展开「智能供应链」', okGroup)
  const okMod = await clickText('.nav-module', '采购管理')
  await sleep(1800)
  check('能打开「采购管理」飞出卡片', okMod)
  const card = await evaluate(`(function(){
    var c = document.querySelector('.fly-card');
    if (!c) return JSON.stringify({ found: false });
    var groups = Array.from(c.querySelectorAll('.card-group')).map(function(g){
      var title = (g.querySelector('.card-group-title')||{}).innerText || '';
      var items = Array.from(g.querySelectorAll('.card-item')).map(function(i){ return (i.innerText||'').replace(/\\s+/g,''); });
      return { title: title.replace(/\\s+/g,''), items: items };
    });
    return JSON.stringify({ found: true, groups: groups });
  })()`)
  console.log('飞出卡片结构:', card)
  const c = JSON.parse(card)
  const portal = (c.groups || []).find((g) => g.title === '供应商门户')
  check('卡片里有「供应商门户」分组', !!portal, (c.groups || []).map((g) => g.title).join(' | '))
  check('供应商门户下有「供应商采购打印」', !!portal && portal.items.includes('供应商采购打印'), portal ? portal.items.join(',') : '')
  check('供应商门户下有「供应商权限配置」', !!portal && portal.items.includes('供应商权限配置'), portal ? portal.items.join(',') : '')
  const docGroup = (c.groups || []).find((g) => g.title === '单据')
  check('「单据」组里不再重复挂采购打印', !!docGroup && !docGroup.items.includes('供应商采购打印'), docGroup ? docGroup.items.join(',') : '')
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, '_menu-location.png'), Buffer.from(shot.result.data, 'base64'))
  const pass = results.filter((r) => r.ok).length
  console.log(`\n=== 结果: ${pass}/${results.length} 通过 ===`)
  try { sock.close() } catch (e) {}
  await closeBrowser(CDP_PORT)
  killTree(proc.pid)
  process.exit(pass === results.length ? 0 : 1)
}
main().catch((e) => { console.error('[FATAL]', e); process.exit(2) })
