/**
 * _ui-topbar-guard.cjs — 顶栏回归闸:内部账号(管理员)必须看到整条桌面顶栏(2026-10-24)
 *
 * 由来:加「供应商门户」分支时,PortalLayout 内部账号那一支里的 <TopBar /> 被误删了一行,
 *      结果**所有内部账号**的顶栏(账本/搜索/公告/通知/系统管理员)整条消失,而侧栏、我的桌面都在
 *      —— 只跑"接口/单测"根本发现不了。本脚本按**真实渲染结果**断言:
 *        ① 内部账号:有顶栏(含「我的桌面」左侧导航 + 顶栏品牌区),且不含供应商顶栏;
 *        ② 供应商账号:有供应商顶栏,且**没有**桌面顶栏/侧栏/页签。
 * 用法:先起服务(8090 打包版或 5173 源码版),node tools/archive/_ui-topbar-guard.cjs [baseUrl]
 *      默认 http://127.0.0.1:8090/
 */
const CDP_PORT = 9393
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')
const os = require('os')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://127.0.0.1:8090/'
const SUP_USER = process.argv[3] || ''
const SUP_PASS = process.argv[4] || ''
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function httpJson(p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => {
      let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } })
    }).on('error', rej)
  })
}

const results = []
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail ?? '' })
  console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`)
}

async function main() {
  const proc = spawn(EDGE, [`--remote-debugging-port=${CDP_PORT}`, '--headless=new', '--disable-gpu',
    '--window-size=1440,900', '--user-data-dir=' + path.join(os.tmpdir(), '_topbar_guard'), 'about:blank'],
  { stdio: 'ignore', detached: true })
  proc.unref()
  await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list && list.length) break } catch (e) {} await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require(path.join(__dirname, '..', 'verify', 'lib', 'mini-ws.cjs'))
  const { killTree } = require(path.join(__dirname, '..', 'verify', 'lib', 'kill-tree.cjs'))
  const { closeBrowser } = require(path.join(__dirname, '..', 'verify', 'lib', 'browser-close.cjs'))
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
    fs.writeFileSync(path.join(__dirname, `_guard-${name}.png`), Buffer.from(s.result.data, 'base64'))
  }
  const loginAs = async (u, p) => {
    await send('Page.navigate', { url: BASE + '#/login' })
    await sleep(2500)
    await evaluate(`localStorage.clear()`)
    await send('Page.navigate', { url: BASE + '?t=' + Date.now() + '#/login' })
    await sleep(5000)
    const fill = async (sel, value) => evaluate(`(function(){
      var el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return false;
      var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`)
    await fill('input[placeholder="请输入登录账号"]', u)
    await fill('input[placeholder="请输入登录密码"]', p)
    await evaluate(`(function(){var b=Array.from(document.querySelectorAll('button')).find(function(x){return (x.innerText||'').indexOf('进入系统')>=0;}); b && b.click(); return !!b;})()`)
    await sleep(8000)
  }

  // ---------- ① 内部账号(管理员):桌面顶栏必须在 ----------
  console.log('\n== ① 内部账号(admin):桌面顶栏 ==')
  await loginAs('admin', '123456')
  if (BASE.includes('8090')) {
    // 打包版里 admin 上一轮可能停在新页面上(供应商账号被删后页面调接口吃 403),
    // 先在浏览器内 API 登录拿新令牌再进我的桌面 —— 保证断言的是"正常工作的内部账号"
    const tok = await evaluate(`fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ userName:'admin', password:'123456', factory:'YJ' }) }).then(function(r){ return r.text(); })`)
    const lj = JSON.parse(tok)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)})`)
    await evaluate(`localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user))})`)
  }
  await send('Page.navigate', { url: BASE + '?t=' + Date.now() + '#/dashboard' })
  await sleep(3000)
  await send('Page.reload', {})
  await sleep(9000)
  const adm = await evaluate(`(function(){
    var t = (document.body.innerText || '').replace(/\\s+/g, ' ');
    return JSON.stringify({
      hash: location.hash,
      supplierBar: !!document.querySelector('.portal-supplier-bar'),
      // 顶栏判据:页面最上方的品牌区 + 用户下拉(内部账号顶栏特有的两样)
      brandTop: (function(){
        var el = document.querySelector('.topbar') || document.querySelector('[class*="topbar"]');
        if (!el) return -1;
        return Math.round(el.getBoundingClientRect().top);
      })(),
      // 搜索框判据:窄窗口下只显示放大镜图标、提示文字被隐藏 ⇒ 直接找顶栏里的搜索输入框
      hasSearch: (function(){
        var bar = document.querySelector('.topbar') || document.querySelector('[class*="topbar"]');
        return !!(bar && bar.querySelector('input, .search, [class*="search"]'));
      })(),
      hasAccount: t.indexOf('系统管理员') >= 0 || t.indexOf('admin') >= 0,
      leftNav: !!document.querySelector('.el-menu,[class*="left-nav"],[class*="leftnav"]'),
      text: t.slice(0, 200),
    });
  })()`)
  const a = JSON.parse(adm)
  check('内部账号不是供应商会话', !a.supplierBar)
  check('桌面顶栏已渲染且在页面顶部', a.brandTop >= 0 && a.brandTop < 60, `top=${a.brandTop}`)
  check('顶栏里有搜索框', a.hasSearch)
  check('顶栏里有当前账号', a.hasAccount)
  check('左侧导航仍在', a.leftNav)
  await shot('admin-topbar')

  // ---------- ② 供应商账号:只有供应商顶栏 ----------
  if (SUP_USER && SUP_PASS) {
    console.log('\n== ② 供应商账号:只有供应商顶栏 ==')
    await loginAs(SUP_USER, SUP_PASS)
    const sup = await evaluate(`(function(){
      var t = (document.body.innerText || '').replace(/\\s+/g, ' ');
      return JSON.stringify({
        hash: location.hash,
        supplierBar: !!document.querySelector('.portal-supplier-bar'),
        deskTopbar: !!document.querySelector('.topbar'),
        leftNav: !!document.querySelector('.el-menu'),
        tabs: !!document.querySelector('[class*="tabs-bar"]'),
      });
    })()`)
    const s = JSON.parse(sup)
    check('供应商落地供应商采购打印', s.hash.includes('/scm/supplierPrint'), s.hash)
    check('有供应商顶栏', s.supplierBar)
    check('没有桌面顶栏', !s.deskTopbar)
    check('没有左侧导航', !s.leftNav)
    check('没有页签', !s.tabs)
    await shot('supplier-topbar')
  } else {
    console.log('\n(跳过供应商侧:未传账号密码)')
  }

  const pass = results.filter((r) => r.ok).length
  console.log(`\n=== 结果: ${pass}/${results.length} 通过 ===`)
  try { sock.close() } catch (e) {}
  await closeBrowser(CDP_PORT)
  killTree(proc.pid)
  process.exit(pass === results.length ? 0 : 1)
}
main().catch((e) => { console.error('[FATAL]', e); process.exit(2) })
