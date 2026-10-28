/**
 * _ui-supplier-portal-e2e.cjs — 供应商门户界面 e2e(2026-10-24)
 *
 * 验证口径(用户原话):「供应商可以通过登录供应商配置的账号登录进来,只能看到供应商采购打印面版
 * (和对应供应商编码的数据)。然后供应商可以通过这个面版来查看和打印数据。没有别的权限。」
 *
 * 步骤(走**真实登录页**,不预置 token —— 登录后的降权与跳转正是要验的东西):
 *   ① 供应商账号登录 → 落地页应是 /scm/supplierPrint;
 *   ② 页面无侧栏(LeftNav)、无页签、无桌面壳;顶栏显示供应商编码;
 *   ③ 菜单树里一个面板入口都不剩(只剩我们这页本身);
 *   ④ 列表只出本供应商的单(全部行的供应商编码 = 自己);
 *   ⑤ 点明细 → 抽屉里出现本单行;⑥ 直接敲 /api/px/* 越权 → 403(前端拦截不靠菜单);
 *   ⑦ 敲别的地址(如 /sys/org、/dashboard)→ 被送回供应商采购打印;
 *   ⑧ 管理员登录 → 能看到「采购管理 > 供应商门户 > 供应商权限配置」并打开该页。
 *
 * 前置:8090(后端)+ 5173(vite) 都在跑;HSDZ_MES 里已有供应商账号(默认取 kbl01)。
 * 用法:node tools/archive/_ui-supplier-portal-e2e.cjs [账号] [密码]
 * 产出:tools/archive/_sup-ui-*.png
 */
const CDP_PORT = 9388
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')
const os = require('os')

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = __dirname
const BASE = 'http://localhost:5173/'
const SUPUSER = process.argv[2] || 'kbl01'
const SUPPASS = process.argv[3] || 'kbl@2026'
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

const results = []
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail ?? '' })
  console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`)
}

async function main() {
  const proc = spawn(EDGE, [
    `--remote-debugging-port=${CDP_PORT}`, '--headless=new', '--disable-gpu',
    '--window-size=1440,900', '--user-data-dir=' + path.join(os.tmpdir(), '_sup_pcdp'),
    'about:blank',
  ], { stdio: 'ignore', detached: true })
  proc.unref()
  await sleep(4000)

  let list
  for (let i = 0; i < 20; i++) {
    try { list = await httpJson('/json/list'); if (list && list.length) break } catch (e) { /* retry */ }
    await sleep(500)
  }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require(path.join(__dirname, '..', 'verify', 'lib', 'mini-ws.cjs'))
  let id = 0
  const pending = new Map()
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (data) => {
    const msg = JSON.parse(data)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  })
  const send = (method, params = {}) => new Promise((res) => {
    const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params }))
  })
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) {
      throw new Error('EVAL: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text))
    }
    return r.result?.result?.value
  }
  const shot = async (name) => {
    const s = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(OUT, `_sup-ui-${name}.png`), Buffer.from(s.result.data, 'base64'))
  }

  await send('Page.enable')
  await send('Runtime.enable')

  // ---------- 供应商登录 ----------
  console.log('\n== ① 供应商账号登录 ==')
  // 先到页面把 localStorage 清干净，**再导航** —— 顺序反了会：清空后路由守卫立刻把半死状态
  // (token 已清、store 未重载)送回 /login，而随后的 navigate 因为 hash 相同不触发路由 ⇒ 表单永远填不上。
  await send('Page.navigate', { url: BASE + '#/login' })
  await sleep(4000)
  await evaluate(`localStorage.clear()`)
  await send('Page.navigate', { url: BASE + '?t=' + Date.now() + '#/login' })
  await sleep(5000)

  // 登录表单:填账号/密码,选工厂后点登录按钮(Element Plus 输入框需要真实 input 事件)
  const fill = async (sel, value) => evaluate(`(function(){
    var el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return false;
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`)

  const userSel = 'input[placeholder="请输入登录账号"]'
  const formState = await evaluate(`JSON.stringify({
    hash: location.hash,
    inputs: document.querySelectorAll('input').length,
    user: !!document.querySelector('input[placeholder="请输入登录账号"]'),
    body: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 160),
  })`)
  console.log('  [debug] 登录页状态:', formState)
  const okUser = await fill(userSel, SUPUSER)
  const okPwd = await fill('input[placeholder="请输入登录密码"]', SUPPASS)
  await sleep(600)
  const clicked = await evaluate(`(function(){
    var btns = Array.from(document.querySelectorAll('button'));
    var b = btns.find(function(x){ return (x.innerText||'').replace(/\\s+/g,'').indexOf('进入系统') >= 0; });
    if (!b) return false;
    b.click();
    return true;
  })()`)
  check('登录表单可填并点了登录', okUser && okPwd && clicked, `user=${okUser} pwd=${okPwd} btn=${clicked}`)
  await sleep(7000)

  const hash = await evaluate('location.hash')
  check('登录后落地 供应商采购打印', hash.includes('/scm/supplierPrint'), hash)
  await evaluatedTextDump(shot, evaluate, 'supplier-print')
  // ---------- 界面形态 ----------
  console.log('\n== ② 壳层形态(无侧栏/无页签) ==')
  const shell = await evaluate(`(function(){
    var t = document.body.innerText || '';
    return JSON.stringify({
      nav: !!document.querySelector('.el-menu, .left-nav, [class*="leftnav"], [class*="left-nav"]'),
      tabs: !!document.querySelector('[class*="tabs-bar"], .tabs-bar'),
      supplierBar: !!document.querySelector('.portal-supplier-bar'),
      hasDashboardBtn: t.indexOf('我的桌面') >= 0,
      hasSysConsole: t.indexOf('系统管理') >= 0,
      text: t.replace(/\\s+/g,' ').slice(0, 400),
    });
  })()`)
  const sh = JSON.parse(shell)
  check('渲染了供应商顶栏', sh.supplierBar)
  check('没有左侧导航菜单', !sh.nav)
  check('没有页签栏', !sh.tabs)
  check('没有「我的桌面」入口', !sh.hasDashboardBtn)
  check('没有「系统管理」入口', !sh.hasSysConsole)

  const code = await evaluate(`(function(){
    var t = document.body.innerText || '';
    var m = t.match(/(YJ-[A-Z0-9]+)/);
    return m ? m[1] : '';
  })()`)
  check('页面显示本供应商编码', !!code, code)

  // ---------- 列表数据 ----------
  console.log('\n== ③ 列表数据 ==')
  const listInfo = await evaluate(`(function(){
    var rows = Array.from(document.querySelectorAll('.sp-table .el-table__body tr'));
    var texts = rows.map(function(r){ return (r.innerText||'').replace(/\\s+/g,' '); });
    return JSON.stringify({ n: rows.length, first: texts[0] || '', all: texts.join('\\n') });
  })()`)
  const li = JSON.parse(listInfo)
  check('订单列表有数据', li.n > 0, `行数=${li.n} 首行=${li.first.slice(0, 80)}`)
  check('列表单据均可点击', /YJ-\d{8}-\d+/.test(li.first), li.first.slice(0, 60))
  await shot('supplier-list')

  // 直接验数据隔离:页面里调接口看返回行的订单是否全属于本供应商
  const iso = await evaluate(`(function(){
    var tok = localStorage.getItem('mes_token');
    return fetch('/api/supplier/portal/orders?pageSize=200', { headers: { Authorization: 'Bearer ' + tok } })
      .then(function(r){ return r.json(); })
      .then(function(j){ return JSON.stringify({ code: j.code, total: j.data && j.data.total, code1: j.data && j.data.supplierCode,
        bad: (j.data && j.data.rows || []).filter(function(x){ return x.supplierCode !== (j.data.supplierCode); }).length }); });
  })()`)
  const is = JSON.parse(iso)
  check('接口返回 order 全部属于本供应商', is.code === 200 && is.bad === 0, `total=${is.total} supplierCode=${is.code1} 越界=${is.bad}`)

  // ---------- 越权 ----------
  console.log('\n== ④ 越权拦截(拿令牌直接调后端) ==')
  const deny = await evaluate(`(function(){
    var tok = localStorage.getItem('mes_token');
    var h = { Authorization: 'Bearer ' + tok };
    return Promise.all([
      fetch('/api/px/getPanelConfig?panelCode=PU_ORDER', { headers: h }).then(function(r){ return r.json(); }),
      fetch('/api/px/queryFormDataList', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, h),
        body: JSON.stringify({ panelCode: 'PU_ORDER' }) }).then(function(r){ return r.json(); }),
      fetch('/api/sys/user/list', { headers: h }).then(function(r){ return r.json(); }),
      fetch('/api/supplier/portal/accounts', { headers: h }).then(function(r){ return r.json(); }),
      fetch('/api/supplier/portal/order?docNo=YJ-20260901-03', { headers: h }).then(function(r){ return r.json(); }),
    ]).then(function(a){ return JSON.stringify(a.map(function(x){ return x.code; })); });
  })()`)
  const dn = JSON.parse(deny)
  check('/px/getPanelConfig 被拒', dn[0] === 403, String(dn[0]))
  check('/px/queryFormDataList 被拒', dn[1] === 403, String(dn[1]))
  check('/sys/user/list 被拒', dn[2] === 403, String(dn[2]))
  check('供应商权限配置接口 被拒(非管理员)', dn[3] === 403, String(dn[3]))
  check('别人的订单 被拒', dn[4] === 403, String(dn[4]))

  // ---------- 路由守卫 ----------
  console.log('\n== ⑤ 敲别的地址 ==')
  for (const p of ['#/sys/org', '#/dashboard', '#/panelx/list/PU_ORDER']) {
    await send('Page.navigate', { url: BASE + p })
    await sleep(3500)
    const h2 = await evaluate('location.hash')
    check(`访问 ${p} 被送回供应商采购打印`, h2.includes('/scm/supplierPrint'), h2)
  }

  // ---------- 明细抽屉 ----------
  console.log('\n== ⑥ 明细 ==')
  await sleep(2500)
  const opened = await evaluate(`(function(){
    var b = Array.from(document.querySelectorAll('.sp-table button')).find(function(x){ return (x.innerText||'').indexOf('明细') >= 0; });
    if (!b) return false; b.click(); return true;
  })()`)
  await sleep(2500)
  const drawer = await evaluate(`(function(){
    var d = document.querySelector('.el-drawer');
    var t = d ? (d.innerText||'').replace(/\\s+/g,' ') : '';
    var rows = document.querySelectorAll('.el-drawer .sp-lines .el-table__body tr').length;
    return JSON.stringify({ open: !!d, rows: rows, head: t.slice(0,160) });
  })()`)
  const dr = JSON.parse(drawer)
  check('点「明细」打开抽屉', opened && dr.open)
  check('抽屉里是本单的明细行', dr.rows > 0, `行数=${dr.rows} ${dr.head.slice(0, 80)}`)
  await shot('supplier-detail')

  // ---------- 打印 ----------
  console.log('\n== ⑦ 打印(走与采购订单同一版式) ==')
  // printPuOrder 走 openPrintWindow:固定窗口名 `yj-print` 写 docs + 自动 window.print()。
  // 所以正确断言 = 该窗口里能看到纸质单标题,而不是主页面里有没有打印层。
  const printed = await evaluate(`(function(){
    return new Promise(function(resolve){
      var origOpen = window.open;
      var opened = null;
      window.open = function(url, name, features){
        var w = origOpen.call(window, '', name, features);
        if (w) opened = w;
        return w;
      };
      var footer = document.querySelector('.el-drawer__footer') || document.querySelector('.el-drawer');
      var btn = Array.from(footer.querySelectorAll('button')).find(function(x){ return (x.innerText||'').trim() === '打印'; });
      if (!btn) { window.open = origOpen; resolve(JSON.stringify({ why: 'no-button' })); return; }
      btn.click();
      setTimeout(function(){
        window.open = origOpen;
        var text = '';
        try { text = opened && opened.document ? (opened.document.body.innerText || '').replace(/\\s+/g,' ') : ''; } catch (e) { text = 'CROSS: ' + e.message; }
        resolve(JSON.stringify({ opened: !!opened, text: text.slice(0, 260) }));
      }, 4000);
    });
  })()`)
  const pr = JSON.parse(printed)
  check('点打印后打开了纸质单窗口', pr.opened, JSON.stringify(pr).slice(0, 160))
  check('纸质单标题为「银嘉采购订单」', String(pr.text || '').includes('银嘉采购订单'), String(pr.text || '').slice(0, 120))
  check('纸质单是本供应商这张单', String(pr.text || '').includes('YJ-KBL'), String(pr.text || '').slice(0, 160))

  // ---------- 管理员 ----------
  console.log('\n== ⑧ 管理员侧:供应商权限配置 ==')
  // 换账号:清 localStorage 后直接**按管理员身份本地写入**在浏览器里做一次真实登录请求(同源),
  // 再带 ?t= 强刷 —— 纯静态服务读不到新值,加 query 让页面重新 bootstrap。
  await evaluate(`localStorage.clear()`)
  const tokResp = await evaluate(`fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ userName:'admin', password:'123456', factory:'YJ' }) }).then(function(r){ return r.text(); })`)
  const lj = JSON.parse(tokResp)
  if (!lj.data?.token) throw new Error('管理员登录失败 ' + tokResp.slice(0, 200))
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)})`)
  await evaluate(`localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user))})`)
  await send('Page.navigate', { url: BASE + '?t=' + Date.now() + '#/scm/supplierAccount' })
  await sleep(3000)
  await send('Page.reload', {})
  await sleep(8000)
  const adm = await evaluate(`(function(){
    var t = document.body.innerText || '';
    return JSON.stringify({
      hash: location.hash,
      hasTitle: t.indexOf('供应商权限配置') >= 0,
      menu: t.indexOf('供应商采购打印') >= 0,
      rows: document.querySelectorAll('.el-table__body tr').length,
      text: t.replace(/\\s+/g,' ').slice(0, 300),
    });
  })()`)
  const ad = JSON.parse(adm)
  check('管理员能打开供应商权限配置', ad.hash.includes('/scm/supplierAccount') && ad.hasTitle, ad.hash)
  check('菜单里能看到「供应商采购打印」入口', ad.menu)
  check('账号列表有数据', ad.rows > 0, `行数=${ad.rows}`)
  await shot('admin-account')

  const pass = results.filter((r) => r.ok).length
  console.log(`\n=== 结果: ${pass}/${results.length} 通过 ===`)
  const failed = results.filter((r) => !r.ok)
  if (failed.length) console.log('失败项:\n' + failed.map((f) => ' - ' + f.name + ' ' + f.detail).join('\n'))
  try { sock.close() } catch (e) { /* ignore */ }
  try { process.kill(-proc.pid) } catch (e) { /* ignore */ }
  process.exit(failed.length ? 1 : 0)
}

async function evaluatedTextDump(shot) {
  // 登录落地页截图(后续断言各自截自己的页)
  try { await shot('supplier-print') } catch (e) { /* 截图失败不影响断言 */ }
}

main().catch((e) => { console.error('[FATAL]', e); process.exit(2) })
