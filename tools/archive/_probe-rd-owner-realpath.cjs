/**
 * _probe-rd-owner-realpath.cjs —— 复现「真实用户路径」:登录页表单登录 → 立项申请列表 → 点开单据
 * → 看侧栏「确认责任人」按钮状态 + 抓页面自己发出的 rdFlow 请求(2026-10-13)
 *
 * 为什么必须单独复现:前一支探针(_probe-rd-owner-btn.cjs)是**注入 token + 带单号深链**,
 * 这条捷径跳过了正常登录与列表加载。用户报「刷新后按钮仍是灰的」而深链探针显示可点,
 * 差别只可能在「怎么进到这张单」这一步 ⇒ 必须按用户的路径复现。
 *
 * 账套:YJ_TEST(登录页工厂下拉选「YINJIA-MES·测试库」);页面默认 8090,可用 YINJIA_PAGE 覆盖。
 * 只读:不点任何写库按钮。
 * 用法:node tools/archive/_probe-rd-owner-realpath.cjs [单号]
 */
'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const PAGE = process.env.YINJIA_PAGE || 'http://127.0.0.1:8090'
const USER = process.env.PROBE_USER || 'cp'
const PASS = process.env.PROBE_PASS || '123456'
const WANT = process.argv[2] || ''            // 想点开的单号;留空=点列表第一张
const API = 'http://127.0.0.1:8090/api'       // 后端直连(仅用于前置断言,页面上仍走 PAGE 自身)
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9779                             // 避开 Windows 保留段 9181-9680
const SHOTS = path.join(__dirname, '_shots')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  console.log(`\n=== 真实路径复现:${USER} 登录 ${PAGE} → 立项申请列表 → 点开单据 ===`)
  const login = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: USER, password: PASS, factory: 'YJ_TEST' }),
  })).json()
  if (login?.code !== 200) throw new Error('前置登录失败:' + JSON.stringify(login).slice(0, 200))
  console.log(`  前置断言:${USER} → ${login.data.user.realName} factory=${login.data.user.factory}`)

  fs.mkdirSync(SHOTS, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-realpath-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1760,1200', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  let ws = null
  try {
    await sleep(3000)
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR ' + JSON.stringify(r.result.exceptionDetails).slice(0, 200) + '>>'
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const shot = async (tag) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (!r.result?.data) return null
      const f = path.join(SHOTS, `rd-realpath-${tag}.png`)
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }

    await send('Page.enable'); await send('Runtime.enable')
    // 请求钩子:抓页面自己发的 rdFlow 请求(判断「前端到底发没发、发回来什么」)
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.__reqLog = [];
      (function(){
        var of = window.fetch;
        window.fetch = function(){
          var u = (arguments[0] && arguments[0].url) || String(arguments[0]);
          var p = of.apply(this, arguments);
          if (String(u).indexOf('rdFlow') >= 0) {
            p.then(function(r){ r.clone().text().then(function(t){
              window.__reqLog.push({ via:'fetch', url:String(u), status:r.status, body:String(t).slice(0,240) }) })
            }).catch(function(e){ window.__reqLog.push({ via:'fetch', url:String(u), err:String(e) }) });
          }
          return p;
        };
        var oo = XMLHttpRequest.prototype.open, os = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function(m,u){ this.__u = u; return oo.apply(this, arguments); };
        XMLHttpRequest.prototype.send = function(){
          var x = this;
          if (String(x.__u).indexOf('rdFlow') >= 0) {
            x.addEventListener('loadend', function(){
              window.__reqLog.push({ via:'xhr', url:String(x.__u), status:x.status, body:String(x.responseText||'').slice(0,240) });
            });
          }
          return os.apply(this, arguments);
        };
      })();
    ` })
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1200, deviceScaleFactor: 1, mobile: false })

    // ───── ① 进测试账套(注入 YJ_TEST 的令牌)─────
    // ⚠ 本探针要复现的差异是「**怎么进到那张单**」(列表点开 vs 带单号深链),不是「怎么登录」。
    //   表单登录那条路容易选错工厂(页面上还有语言选择器)并静默落到正式库 YJ,反而把结论带偏;
    //   所以这里直接注入测试账套令牌,保证账套正确,把变量收敛到"进入单据的方式"这一个。
    console.log('\n──────── ① 进测试账套 ────────')
    await send('Page.navigate', { url: `${PAGE}/#/login` })
    for (let i = 0; i < 90; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') break }
    await sleep(2000)
    await ev(`localStorage.setItem('mes_init_done','1');
      localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
      localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' })
    await sleep(800)
    // ⚠ 断言必须在**页面自己的 origin** 上读 localStorage —— about:blank 是另一个 origin,读出来全空
    //   (本探针第一版就栽在这:报 factory="" 看着像登录失败,实际只是读错了地方)

    // ───── ② 立项申请列表:看有哪些单 ─────
    console.log('\n──────── ② 立项申请列表 ────────')
    await send('Page.navigate', { url: `${PAGE}/#/panelx/list/RD_APPROVAL` })
    for (let i = 0; i < 90; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') break }
    await sleep(4500)
    const after = await ev(`(function(){ var u={}; try { u = JSON.parse(localStorage.getItem('mes_user')||'{}') } catch(e){}; return { factory: u.factory||'', realName: u.realName||'', hash: location.hash } })()`)
    console.log(`  已进入 = ${JSON.stringify(after)}`)
    if (after.factory !== 'YJ_TEST') {
      console.log(`\n  [ABORT] 账套 factory=${JSON.stringify(after.factory)}(期望 YJ_TEST)—— 本次复现无效`)
      const fAbort = await shot('wrong-ledger')
      console.log(`  截图:${fAbort}`)
      throw new Error('账套不是 YJ_TEST,复现无效')
    }
    const rows = await ev(`(function(){
      var hits = [];
      var all = document.querySelectorAll('*');
      for (var i=0;i<all.length;i++){
        var e = all[i];
        if (e.children.length === 0 && /LXA-2026-\\d+-\\d+/.test((e.textContent||'').trim())) {
          hits.push({ tag: e.tagName, cls: String(e.className||'').slice(0,60), txt:(e.textContent||'').trim().slice(0,30) });
        }
      }
      return JSON.stringify(hits.slice(0, 12));
    })()`)
    console.log(`  列表里出现的单号元素 = ${rows}`)
    const f0 = await shot('list')
    console.log(`  列表截图:${f0}`)

    // ───── ③ 点开单据(优先点 WANT,否则点第一张) ─────
    console.log('\n──────── ③ 点开单据 ────────')
    const clicked = await ev(`(function(){
      var want = ${JSON.stringify(WANT)};
      var re = /LXA-2026-\\d+-\\d+/;
      var cells = [].slice.call(document.querySelectorAll('*')).filter(function(e){
        if (e.children.length) return false;
        var t = (e.textContent||'').trim();
        if (!re.test(t)) return false;
        return want ? t.indexOf(want) >= 0 : true;
      });
      if (!cells.length) return 'NO_CELL';
      var el = cells[0];
      // 往上找到可点的行/链接
      var node = el, guard = 0;
      while (node && guard++ < 8) {
        if (node.tagName === 'TR' || node.tagName === 'A' || (node.className && String(node.className).indexOf('row') >= 0)) break;
        node = node.parentElement;
      }
      var target = node || el;
      target.click();
      return 'CLICKED:' + target.tagName + '.' + String(target.className||'').slice(0,40) + ' @' + (el.textContent||'').trim();
    })()`)
    console.log(`  点击结果 = ${clicked}`)
    await sleep(4000)

    const opened = await ev(`(function(){ return JSON.stringify({ hash: location.hash }) })()`)
    console.log(`  点击后路由 = ${opened}`)

    const btns = await ev(`(function(){ return [].slice.call(document.querySelectorAll('.as-side-btn')).filter(function(b){return b.offsetParent})
      .map(function(b){ return { text:(b.textContent||'').trim(), disabled:b.classList.contains('disabled'), title:b.getAttribute('title')||'' } }) })()`)
    const all = Array.isArray(btns) ? btns : []
    console.log(`  侧栏 ${all.length} 个可见按钮: ${all.map((b) => (b.disabled ? '[' + b.text + '·灰]' : b.text)).join(' | ')}`)
    const own = all.find((b) => b.text.indexOf('确认责任人') >= 0)
    console.log(`  ★ 确认责任人 = ${own ? (own.disabled ? '置灰' : '可点') + '  title=「' + own.title + '」' : '按钮不存在'}`)
    const docno = await ev(`(function(){
      var t = document.body.innerText || '';
      var m = t.match(/LXA-2026-\\d+-\\d+/); return m ? m[0] : '(页面上找不到单号)';
    })()`)
    console.log(`  当前页面单据号 = ${docno}`)
    console.log(`  页面自己发出的 rdFlow 请求 = ${await ev(`JSON.stringify(window.__reqLog || [])`)}`)
    const f1 = await shot('opened')
    console.log(`  截图:${f1}`)
  } finally {
    if (ws) try { ws.close() } catch { /* ignore */ }
    edge.kill()
  }
  console.log('\n完成(只读,未点任何写库按钮)')
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
