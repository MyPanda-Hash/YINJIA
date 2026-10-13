/**
 * _probe-leftnav.cjs —— dump 左侧导航实际渲染出来的菜单项(2026-10-13)
 *
 * 用途:mesns.js 是静态菜单树,但渲染前会过权限过滤(filterMenuTree 按 visiblePanels)、
 * 且"子节点全叶子时合并一列"。用户报「基础档案的面板缺失那么多」时,需要先拿到
 * **页面上真实出现的项**,再与 menus.js 的声明逐项对比,才能分清是"菜单没渲染"还是"面板没建"。
 *
 * 只读,不点任何写库按钮。
 * 用法:node tools/archive/_probe-leftnav.cjs [要展开的一级菜单标题,默认「基础档案」]
 */
'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.env.YINJIA_PAGE || 'http://127.0.0.1:8090'
const FACTORY = 'YJ_TEST'
const USER = process.env.PROBE_USER || 'admin'
const TARGET = process.argv[2] || '基础档案'
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9780
const SHOTS = path.join(__dirname, '_shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  console.log(`\n=== 左侧导航实况 dump(身份=${USER} / 页 ${BASE} / 展开「${TARGET}」) ===`)
  const lr = await (await fetch(`http://127.0.0.1:8090/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: USER, password: '123456', factory: FACTORY }),
  })).json()
  if (lr?.code !== 200) throw new Error('登录失败:' + JSON.stringify(lr).slice(0, 150))
  console.log(`  ${USER} → ${lr.data.user.realName} factory=${lr.data.user.factory} 可见面板数=${(lr.data.user.visiblePanels || []).length}`)

  fs.mkdirSync(SHOTS, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-leftnav-'))
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
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const nav = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 90; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } }
    }
    const shot = async (tag) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (!r.result?.data) return null
      const f = path.join(SHOTS, `leftnav-${tag}.png`)
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1200, deviceScaleFactor: 1, mobile: false })
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(lr.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/#/`)

    // 先 dump 左侧栏在**未展开**时的一级项
    const level1 = await ev(`(function(){
      return [].slice.call(document.querySelectorAll('*')).filter(function(e){
        var r = e.getBoundingClientRect()
        return e.children.length === 0 && r.width > 0 && r.left < 320 && (e.textContent||'').trim()
      }).map(function(e){ return (e.textContent||'').trim() })
    })()`)
    console.log(`\n  未展开时左侧栏文本(${(level1 || []).length} 条):`)
    console.log('    ' + (level1 || []).join(' | '))

    // 先 dump 菜单相关的 DOM 容器结构(找可点节点 —— 上一版盲点落到 portal-body 没展开)
    const struct = await ev(`(function(){
      var seen = [];
      [].slice.call(document.querySelectorAll('[class*="menu"],[class*="nav"],[class*="Menu"],[class*="Nav"]')).forEach(function(e){
        var r = e.getBoundingClientRect();
        if (r.width <= 0 || r.left > 340) return;
        var t = (e.textContent||'').trim().slice(0, 30);
        seen.push(e.tagName + '.' + String(e.className||'').slice(0,60) + '  ::  ' + t);
      });
      return seen.slice(0, 25).join('\\n    ');
    })()`)
    console.log(`\n  左侧菜单相关容器:\n    ${struct}`)

    // 点开目标一级菜单:优先点带 menu/nav class 且文本恰好等于目标的可点节点
    const clicked = await ev(`(function(){
      var want = ${JSON.stringify(TARGET)};
      var cands = [].slice.call(document.querySelectorAll('*')).filter(function(e){
        var r = e.getBoundingClientRect();
        if (r.left > 340 || r.width <= 0) return false;
        var t = (e.textContent||'').trim();
        if (t !== want) return false;
        var cls = String(e.className||'');
        return /menu|nav|item/i.test(cls) || e.tagName === 'A' || e.tagName === 'LI' || e.tagName === 'BUTTON';
      });
      if (!cands.length) return 'NO_CANDIDATE';
      var el = cands[cands.length - 1];
      el.click();
      return 'CLICKED:' + el.tagName + '.' + String(el.className||'').slice(0,50);
    })()`)
    console.log(`\n  点开「${TARGET}」= ${clicked}`)
    await sleep(1800)

    const level2 = await ev(`(function(){
      return [].slice.call(document.querySelectorAll('*')).filter(function(e){
        var r = e.getBoundingClientRect()
        return e.children.length === 0 && r.width > 0 && r.left < 320 && (e.textContent||'').trim()
      }).map(function(e){ return (e.textContent||'').trim() })
    })()`)
    console.log(`\n  展开后左侧栏文本(${(level2 || []).length} 条):`)
    console.log('    ' + (level2 || []).join(' | '))

    // 展开一级后的容器结构(二级项的可点节点 class 在这里露出来)
    const struct2 = await ev(`(function(){
      var seen = [];
      [].slice.call(document.querySelectorAll('.leftnav *')).forEach(function(e){
        var r = e.getBoundingClientRect();
        if (r.width <= 0 || r.left > 340) return;
        var cls = String(e.className||'');
        if (!/nav|menu|item|sub/i.test(cls)) return;
        seen.push(e.tagName + '.' + cls.slice(0,54) + '  ::  ' + (e.textContent||'').trim().slice(0,22));
      });
      return seen.slice(0, 30).join('\\n    ');
    })()`)
    console.log(`\n  展开一级后的可点节点:\n    ${struct2}`)

    // 逐个点开二级组(手风琴:点开一个会收掉另一个,所以必须一次只点一个、点完立刻 dump)
    for (const g of ['基础数据', '物料及价格', '生产', '财务']) {
      const c = await ev(`(function(){
        var el = [].slice.call(document.querySelectorAll('.leftnav .nav-module')).filter(function(e){
          return (e.textContent||'').trim() === ${JSON.stringify(g)};
        })[0];
        if (!el) return 'NOT_FOUND'; el.click(); return 'CLICKED';
      })()`)
      await sleep(1000)
      const leaves = await ev(`(function(){
        return [].slice.call(document.querySelectorAll('.leftnav *')).filter(function(e){
          var r = e.getBoundingClientRect();
          return e.children.length === 0 && r.width > 0 && (e.textContent||'').trim();
        }).map(function(e){ return (e.textContent||'').trim() });
      })()`)
      console.log(`\n  【${g}】(${c}) → ${(leaves || []).join(' | ')}`)
    }
    const f = await shot('base')
    console.log(`\n  截图:${f}`)
  } finally {
    if (ws) try { ws.close() } catch { /* ignore */ }
    edge.kill()
  }
  console.log('\n完成(只读)')
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
