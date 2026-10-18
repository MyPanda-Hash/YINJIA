/** _q-sysconsole.cjs — 系统管理平台改版实测:
 *   admin: /sys/console 四张卡 + 侧边「系统管理平台」只剩系统功能三叶 + 数据建模含迁入分组
 *   cp(受限): 看不到 组织架构/使用权限查看(菜单 + 直达 URL),/sys/console 无「管理员功能」卡
 * 用法: node tools/archive/_sysconsole-ui/_q-sysconsole.cjs
 */
const CDP_PORT = 9439
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = __dirname
const BASE = 'http://127.0.0.1:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => {
      let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } })
    }).on('error', rej)
  })
}
async function login(userName, password) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName, password, factory: 'YJ' }) })
  const j = await r.json()
  if (!j.data || !j.data.token) throw new Error('登录失败 ' + userName + ': ' + JSON.stringify(j).slice(0, 200))
  return { token: j.data.token, user: JSON.stringify(j.data.user || {}) }
}
async function main() {
  const admin = await login('admin', '123456')
  const cp = await login('cp', '123456')
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu', '--window-size=1600,1000', '--user-data-dir=' + path.join(os.tmpdir(), '_sysconsole_cdp'), 'about:blank'], { stdio: 'ignore', detached: true })
  proc.unref(); await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) {} await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require('../../verify/lib/mini-ws.cjs')
  let id = 0; const pending = new Map(); const errs = []
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (d) => {
    const m = JSON.parse(d)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
    if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception?.description || '').slice(0, 160))
  })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (e) => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error('EVAL: ' + (r.result.exceptionDetails.exception?.description || '').slice(0, 300))
    return r.result?.result?.value
  }
  await send('Page.enable'); await send('Runtime.enable')

  const menuText = () => ev(`(function(){
    var el = document.querySelector('.el-menu') || document.querySelector('aside') || document.body
    var segs = Array.prototype.map.call(el.querySelectorAll('span,div'), function(n){ return (n.innerText||'').trim() })
    var out = []
    segs.forEach(function(s){ if (s && s.length <= 12 && out.indexOf(s) < 0) out.push(s) })
    return out.join('|')
  })()`)

  async function as(acc, tag) {
    await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2500)
    await ev('localStorage.setItem("mes_token", ' + JSON.stringify(acc.token) + ')')
    await ev('localStorage.setItem("mes_user", ' + JSON.stringify(acc.user) + ')')
    await send('Page.reload', {}); await sleep(6500)
    await ev('location.hash = "#/sys/console"'); await sleep(5000)
    const cards = await ev(`(function(){
      var t = document.body.innerText || ''
      var need = ['账号信息','修改密码','显示设置','管理员功能']
      var has = {}
      need.forEach(function(k){ has[k] = t.indexOf(k) >= 0 })
      return JSON.stringify(has)
    })()`)
    const menu = await menuText()
    const menuKeys = ['组织架构', '使用权限查看', '系统管理', '系统功能']
    const menuSummary = {}
    menuKeys.forEach((k) => { menuSummary[k] = menu.indexOf(k) >= 0 })
    // 直达受限页面(非管理员应被拦)
    await ev('location.hash = "#/sys/org"'); await sleep(3500)
    const orgHash = await ev('location.hash')
    const orgText = await ev('(document.body.innerText||"").slice(0,300)')
    console.log(tag + '_CARDS ' + cards)
    console.log(tag + '_MENU ' + JSON.stringify(menuSummary))
    console.log(tag + '_ORG_HASH ' + orgHash + ' | head=' + JSON.stringify(orgText.replace(/\s+/g, ' ').slice(0, 90)))
    return { cards, menu, orgHash, orgText }
  }

  const a = await as(admin, 'ADMIN')
  await ev('location.hash = "#/sys/console"'); await sleep(4500)
  let shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, '_console-admin.png'), Buffer.from(shot.result.data, 'base64'))
  // 侧边栏:展开「系统管理平台」一级目录看二级
  const baseExpand = await ev(`(function(){
    var nodes = Array.prototype.slice.call(document.querySelectorAll('.el-sub-menu__title, .el-menu-item'))
    for (var i=0;i<nodes.length;i++){
      var t = (nodes[i].innerText||'').trim()
      if (t === '系统管理平台') { nodes[i].click(); return 'clicked' }
    }
    return 'not-found:' + nodes.slice(0,12).map(function(n){return (n.innerText||'').trim()}).join(',')
  })()`)
  await sleep(2000)
  const baseChildren = await ev(`(function(){
    var titles = Array.prototype.slice.call(document.querySelectorAll('.el-sub-menu__title, .el-menu-item')).map(function(n){ return (n.innerText||'').replace(/\s+/g,' ').trim() })
    var i = titles.indexOf('系统管理平台')
    return JSON.stringify({ idx: i, after: titles.slice(i, i + 6) })
  })()`)
  console.log('ADMIN_BASE_EXPAND ' + baseExpand)
  console.log('ADMIN_BASE_CHILDREN ' + baseChildren)
  shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, '_console-admin-menu.png'), Buffer.from(shot.result.data, 'base64'))

  const c = await as(cp, 'CP')
  await ev('location.hash = "#/sys/console"'); await sleep(4000)
  shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, '_console-cp.png'), Buffer.from(shot.result.data, 'base64'))

  // 权限矩阵分组(管理员口径)
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2000)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(admin.token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(admin.user) + ')')
  await send('Page.reload', {}); await sleep(6000)
  await ev('location.hash = "#/sys/org"'); await sleep(7000)
  const groups = await ev(`(function(){
    var hs = Array.prototype.slice.call(document.querySelectorAll('.el-collapse-item__header')).map(function(h){ return (h.innerText||'').replace(/\s+/g,' ').trim() })
    return JSON.stringify(hs)
  })()`)
  console.log('PERM_GROUPS ' + groups)
  console.log('ERRS ' + JSON.stringify(errs.slice(0, 5)))
  process.exit(0)
}
main().catch((e) => { console.error('FAIL ' + e.message); process.exit(1) })
