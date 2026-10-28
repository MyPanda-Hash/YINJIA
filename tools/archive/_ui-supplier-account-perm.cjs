/**
 * _ui-supplier-account-perm.cjs — 「供应商权限配置」组织架构授权的界面验证(2026-10-25)
 *
 * ① 管理员打开「组织架构 → 角色与面板权限」:智能供应链组里能找到「供应商权限配置 / 配置供应商账号」这一格;
 * ② 被授权角色下的账号登录:菜单里出现「采购管理 → 供应商门户 → 供应商权限配置」;
 * ③ 未授权账号登录:菜单里**没有**该入口,且直接敲路由被送回。
 *
 * 前置:_v-supplier-account-perm.cjs 跑完会清理测试角色;本脚本自己建/清。
 * 用法:node tools/archive/_ui-supplier-account-perm.cjs [baseUrl]
 */
const CDP_PORT = 9394
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')
const os = require('os')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/?$/, '/')
const ROLE_CODE = 'supplier_cfg_ui'
const TEST_USER = 'supcfgui'
const TEST_PASS = 'Test@20261026'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const results = []
function check(name, ok, detail) {
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
  const api = async (p, { method = 'GET', token, body } = {}) => {
    const r = await fetch(BASE + p.replace(/^\//, ''), {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return JSON.parse(await r.text())
  }
  const at = (await api('/api/auth/login', { method: 'POST', body: { userName: 'admin', password: '123456', factory: 'YJ' } })).data.token

  // 准备:角色 + 账号 + 授权 supplier 词
  for (const r of ((await api('/api/sys/role/list', { token: at })).data || []).filter((x) => x.roleCode === ROLE_CODE)) {
    await api('/api/sys/role/' + r.id, { method: 'DELETE', token: at })
  }
  for (const u of ((await api('/api/sys/user/list', { token: at })).data || []).filter((x) => x.userName === TEST_USER)) {
    await api('/api/sys/user/' + u.id, { method: 'DELETE', token: at })
  }
  await api('/api/sys/role/save', { method: 'POST', token: at, body: { roleCode: ROLE_CODE, roleName: '供应商配置界面测试' } })
  const role = ((await api('/api/sys/role/list', { token: at })).data || []).find((x) => x.roleCode === ROLE_CODE)
  await api('/api/sys/user/save', {
    method: 'POST', token: at,
    body: { userName: TEST_USER, realName: '界面测试', password: TEST_PASS, roleId: role.id, enabled: '1' },
  })

  const proc = spawn(EDGE, [`--remote-debugging-port=${CDP_PORT}`, '--headless=new', '--disable-gpu',
    '--window-size=1600,1000', '--user-data-dir=' + path.join(os.tmpdir(), '_supacc_ui'), 'about:blank'],
  { stdio: 'ignore', detached: true })
  proc.unref()
  await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list && list.length) break } catch (e) {} await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require(path.join(__dirname, '..', 'verify', 'lib', 'mini-ws.cjs'))
  const { killTree } = require(path.join(__dirname, '..', 'verify', 'lib', 'kill-tree.cjs'))
  const { closeBrowser, killHeadlessEdge } = require(path.join(__dirname, '..', 'verify', 'lib', 'browser-close.cjs'))
  let id = 0
  const pending = new Map()
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (data) => { const m = JSON.parse(data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300))
    return r.result?.result?.value
  }
  const shot = async (name) => {
    const s = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(__dirname, `_perm-ui-${name}.png`), Buffer.from(s.result.data, 'base64'))
  }
  const setLogin = async (userName, password) => {
    const lr = await api('/api/auth/login', { method: 'POST', body: { userName, password, factory: 'YJ' } })
    await evaluate(`localStorage.clear()`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(lr.data.token)})`)
    await evaluate(`localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))})`)
    return lr.data.user
  }
  const goto = async (hash) => {
    await send('Page.navigate', { url: BASE + '?t=' + Date.now() + hash })
    await sleep(2500)
    await send('Page.reload', {})
    await sleep(7000)
  }

  await send('Page.enable')

  // ---------- ① 组织架构里能看到这一格 ----------
  console.log('\n== ① 组织架构 → 角色与面板权限:能找到「配置供应商账号」 ==')
  await goto('#/login')
  await setLogin('admin', '123456')
  await goto('#/sys/org')
  // 点一个非管理员角色行 → 矩阵出现
  await evaluate(`(function(){
    var rows = Array.from(document.querySelectorAll('.el-table__body-wrapper tr'));
    for (var i = rows.length - 1; i >= 0; i--) {
      var t = rows[i].innerText || '';
      if (t.indexOf('超级') < 0 && t.trim()) {
        var td = rows[i].querySelector('td') || rows[i];
        ['mousedown','mouseup','click'].forEach(function(ev){ td.dispatchEvent(new MouseEvent(ev,{bubbles:true,cancelable:true,view:window})); });
        return true;
      }
    }
    return false;
  })()`)
  await sleep(3000)
  // 分组默认折叠(2026-10-10:124 个面板一次铺开会卡),必须**先展开「智能供应链」组**再断言,
  // 否则折叠的头里只有组名与计数,面板行根本不在 DOM 里(误判成"矩阵里没有这一行")。
  const opened = await evaluate(`(function(){
    var heads = Array.from(document.querySelectorAll('.perm-collapse .el-collapse-item__header, .perm-collapse .el-collapse-item__header *'));
    var h = heads.find(function(x){ return (x.innerText || '').indexOf('智能供应链') >= 0; });
    if (!h) return false;
    h.click();
    return true;
  })()`)
  check('能展开「智能供应链」权限组', opened)
  await sleep(2000)
  const matrix = await evaluate(`(function(){
    var t = (document.body.innerText || '').replace(/\\s+/g,' ');
    return JSON.stringify({
      groups: document.querySelectorAll('.perm-collapse .el-collapse-item').length,
      hasPanel: t.indexOf('供应商权限配置') >= 0,
      hasWord: t.indexOf('配置供应商账号') >= 0,
      hasPrint: t.indexOf('供应商采购打印') >= 0,
    });
  })()`)
  const m = JSON.parse(matrix)
  check('权限矩阵已渲染', m.groups > 0, `分组 ${m.groups} 个`)
  check('矩阵里有「供应商采购打印」这一行', m.hasPrint)
  check('矩阵里有「供应商权限配置」这一行', m.hasPanel)
  check('动作列有「配置供应商账号」', m.hasWord)
  await shot('org-matrix')

  // ---------- ② 授权后:菜单出现入口 ----------
  console.log('\n== ② 授权后账号登录:菜单出现入口 ==')
  const pv = (await api('/api/sys/role/' + role.id + '/panels', { token: at })).data
  const merged = (pv.granted || []).map((g) => ({ panelCode: g.panelCode, perms: g.perms }))
    .filter((g) => g.panelCode !== 'SUPPLIER_ACCOUNT')
  merged.push({ panelCode: 'SUPPLIER_ACCOUNT', perms: 'view,supplier' })
  await api('/api/sys/role/' + role.id + '/panels', { method: 'POST', token: at, body: { panels: merged } })

  await setLogin(TEST_USER, TEST_PASS)
  await goto('#/dashboard')
  const menu = await evaluate(`(function(){
    var t = (document.body.innerText || '').replace(/\\s+/g,' ');
    return JSON.stringify({ hash: location.hash, hasEntry: t.indexOf('供应商权限配置') >= 0, text: t.slice(0, 120) });
  })()`)
  const mu = JSON.parse(menu)
  check('授权账号登录后菜单里出现「供应商权限配置」', mu.hasEntry, JSON.stringify(mu).slice(0, 140))
  await shot('authorized-menu')

  await goto('#/scm/supplierAccount')
  const page = await evaluate(`(function(){
    var t = (document.body.innerText || '').replace(/\\s+/g,' ');
    return JSON.stringify({ hash: location.hash, title: t.indexOf('供应商权限配置') >= 0, hint: t.indexOf('组织架构') >= 0 });
  })()`)
  const pg = JSON.parse(page)
  check('授权账号能直接进入该页', pg.hash.includes('/scm/supplierAccount') && pg.title, pg.hash)
  check('页面写明授权来源(组织架构)', pg.hint)
  await shot('authorized-page')

  // ---------- ③ 收回后:菜单消失 + 直连被送回 ----------
  console.log('\n== ③ 收回授权后 ==')
  await api('/api/sys/role/' + role.id + '/panels', {
    method: 'POST', token: at, body: { panels: merged.filter((g) => g.panelCode !== 'SUPPLIER_ACCOUNT') },
  })
  await setLogin(TEST_USER, TEST_PASS)
  await goto('#/dashboard')
  const menu2 = await evaluate(`(document.body.innerText || '').indexOf('供应商权限配置') >= 0`)
  check('收回后菜单里不再出现该入口', menu2 === false)
  await goto('#/scm/supplierAccount')
  const h2 = await evaluate('location.hash')
  check('收回后直连该路由被送回', !h2.includes('/scm/supplierAccount'), h2)

  // ---------- 清理 ----------
  for (const u of ((await api('/api/sys/user/list', { token: at })).data || []).filter((x) => x.userName === TEST_USER)) {
    await api('/api/sys/user/' + u.id, { method: 'DELETE', token: at })
  }
  for (const r of ((await api('/api/sys/role/list', { token: at })).data || []).filter((x) => x.roleCode === ROLE_CODE)) {
    await api('/api/sys/role/' + r.id, { method: 'DELETE', token: at })
  }
  console.log('\n(测试角色/账号已清理)')

  const pass = results.filter((r) => r.ok).length
  console.log(`\n=== 结果: ${pass}/${results.length} 通过 ===`)
  try { sock.close() } catch (e) {}
  await closeBrowser(CDP_PORT)
  killTree(proc.pid)
  killHeadlessEdge('_acc_perm')
  process.exitCode = pass === results.length ? 0 : 1   // 用 exitCode:process.exit() 会截断管道里的 stdout
}
main().catch((e) => {
  console.error('[FATAL]', e)
  // 异常路径也要收掉浏览器,否则一次失败就泄漏一整份(曾把 8090 拖死)
  try { killHeadlessEdge('_acc_perm') } catch (e2) { /* ignore */ }
  process.exitCode = 2
})
