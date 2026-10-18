/** _q-sysconsole2.cjs — 系统管理平台改版二次取证:
 *   ① 侧边栏「系统管理平台」展开后只剩「系统功能」三叶 ② 权限矩阵「数据建模」分组含迁入面板
 *   ③ 1440x900 视口下入口页整页截图(admin / cp 对照) ④ 角色列已显示真实角色名
 */
const CDP_PORT = 9441
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
  if (!j.data || !j.data.token) throw new Error('登录失败 ' + userName)
  return { token: j.data.token, user: JSON.stringify(j.data.user || {}) }
}
async function main() {
  const admin = await login('admin', '123456')
  const cp = await login('cp', '123456')
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu', '--user-data-dir=' + path.join(os.tmpdir(), '_sysconsole_cdp2'), 'about:blank'], { stdio: 'ignore', detached: true })
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
  const shot = async (name) => {
    const s = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(OUT, name), Buffer.from(s.result.data, 'base64'))
  }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

  async function as(acc) {
    await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2500)
    await ev('localStorage.setItem("mes_token", ' + JSON.stringify(acc.token) + ')')
    await ev('localStorage.setItem("mes_user", ' + JSON.stringify(acc.user) + ')')
    await send('Page.reload', {}); await sleep(6500)
  }

  // ── admin:入口页 ──
  await as(admin)
  await ev('location.hash = "#/sys/console"'); await sleep(5000)
  console.log('ADMIN_ROLE_ROW ' + await ev(`(function(){
    var rows = Array.prototype.slice.call(document.querySelectorAll('.el-descriptions__row, .el-descriptions tr'))
    var out = []
    rows.forEach(function(r){ out.push((r.innerText||'').replace(/\s+/g,' ').trim()) })
    return JSON.stringify(out)
  })()`))
  await shot('_console-admin-1440.png')
  // 侧边栏结构
  console.log('SIDEBAR_HTML ' + await ev(`(function(){
    var el = document.querySelector('aside') || document.querySelector('.sidebar') || document.querySelector('.el-menu')
    if (!el) return 'no-sidebar'
    return el.className + ' >> ' + el.outerHTML.slice(0, 700).replace(/\s+/g,' ')
  })()`))

  // ── 权限矩阵 ──
  await ev('location.hash = "#/sys/org"'); await sleep(7000)
  const pick = await ev(`(function(){
    var rows = document.querySelectorAll('.el-table__body-wrapper tbody tr')
    for (var i=0;i<rows.length;i++){
      var t = rows[i].innerText || ''
      if (t.indexOf('普通用户') >= 0) {
        var td = rows[i].querySelector('td') || rows[i]
        ;['mousedown','mouseup','click'].forEach(function(e){ td.dispatchEvent(new MouseEvent(e,{bubbles:true,cancelable:true,view:window})) })
        return t.replace(/\s+/g,' ').trim().slice(0,30)
      }
    }
    return 'not-found'
  })()`)
  await sleep(5000)
  console.log('PERM_PICK ' + pick)
  console.log('PERM_GROUPS ' + await ev(`(function(){
    var hs = Array.prototype.slice.call(document.querySelectorAll('.el-collapse-item__header')).map(function(h){ return (h.innerText||'').replace(/\s+/g,' ').trim() })
    return JSON.stringify(hs)
  })()`))
  // 展开全部分组并数「数据建模」里的面板行
  await ev('(function(){ var hs=document.querySelectorAll(".el-collapse-item__header"); Array.prototype.forEach.call(hs,function(h){ if(h.className.indexOf("is-active")<0) h.click() }); return hs.length })()')
  await sleep(3000)
  console.log('DM_PANEL_ROWS ' + await ev(`(function(){
    var items = Array.prototype.slice.call(document.querySelectorAll('.el-collapse-item'))
    for (var i=0;i<items.length;i++){
      var h = items[i].querySelector('.el-collapse-item__header')
      if (h && (h.innerText||'').indexOf('数据建模') >= 0) {
        var names = Array.prototype.slice.call(items[i].querySelectorAll('tbody tr')).map(function(tr){ return (tr.innerText||'').replace(/\s+/g,' ').trim().split(' ')[0] })
        return JSON.stringify({ header: (h.innerText||'').replace(/\s+/g,' ').trim(), rows: names.length, sample: names.slice(0,6) })
      }
    }
    return 'group-not-found'
  })()`))
  console.log('SYS_SEC_GROUP ' + await ev(`(function(){
    var hs = Array.prototype.slice.call(document.querySelectorAll('.el-collapse-item__header')).map(function(h){ return (h.innerText||'').replace(/\s+/g,' ').trim() })
    return JSON.stringify(hs.filter(function(t){ return t.indexOf('系统管理平台') >= 0 || t.indexOf('数据建模') >= 0 }))
  })()`))
  // 侧边栏:回到首页后展开一级目录
  await ev('location.hash = "#/"'); await sleep(4000)
  const clickRes = await ev(`(function(){
    var all = Array.prototype.slice.call(document.querySelectorAll('*'))
    for (var i=0;i<all.length;i++){
      var el = all[i]
      if (el.children.length === 0 && (el.innerText||'').trim() === '系统管理平台') {
        var p = el
        for (var k=0;k<4 && p;k++) p = p.parentElement
        ;(el.closest('.el-sub-menu__title') || el.parentElement || el).click()
        return 'clicked@' + (el.parentElement ? el.parentElement.className : '?')
      }
    }
    return 'not-found'
  })()`)
  await sleep(2500)
  console.log('SIDEBAR_BASE_CLICK ' + clickRes)
  console.log('SIDEBAR_BASE_CHILDREN ' + await ev(`(function(){
    var titles = Array.prototype.slice.call(document.querySelectorAll('.el-sub-menu__title, .el-menu-item, .menu-leaf, .sub-title')).map(function(n){ return (n.innerText||'').replace(/\s+/g,' ').trim() })
    var i = titles.indexOf('系统管理平台')
    return JSON.stringify({ idx: i, seq: titles.slice(Math.max(i,0), i + 8) })
  })()`))
  await shot('_sidebar-admin-1440.png')

  // ── cp:入口页 + 菜单 ──
  await as(cp)
  await ev('location.hash = "#/sys/console"'); await sleep(5000)
  console.log('CP_ROLE_ROW ' + await ev(`(function(){
    var rows = Array.prototype.slice.call(document.querySelectorAll('.el-descriptions__row, .el-descriptions tr'))
    return JSON.stringify(rows.map(function(r){ return (r.innerText||'').replace(/\s+/g,' ').trim() }))
  })()`))
  console.log('CP_HAS_ADMIN_CARD ' + await ev('(document.body.innerText||"").indexOf("管理员功能") >= 0'))
  await shot('_console-cp-1440.png')
  await ev('location.hash = "#/"'); await sleep(3500)
  console.log('CP_SIDEBAR ' + await ev(`(function(){
    var t = (document.body.innerText||'').replace(/\s+/g,' ')
    return JSON.stringify({ 组织架构: t.indexOf('组织架构') >= 0, 使用权限查看: t.indexOf('使用权限查看') >= 0, 系统管理平台: t.indexOf('系统管理平台') >= 0 })
  })()`))
  console.log('ERRS ' + JSON.stringify(errs.slice(0, 5)))
  process.exit(0)
}
main().catch((e) => { console.error('FAIL ' + e.message); process.exit(1) })
