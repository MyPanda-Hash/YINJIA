// _aspmis-probe/runtime-probe.cjs — 生产站运行时逻辑验证(headless Edge + CDP,只读)
// 验证点: ①登录页内联脚本 eles 语法错误的实际影响 ②登录表单提交方式
//         ③/admin 菜单+tab+iframe 机制 ④welcome echarts 渲染 ⑤console 错误采集
// 用法: node runtime-probe.cjs
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('../../node_modules/ws')
const PORT = 9461
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'https://www.aspmis.com:160'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-asp-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1200',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); const consoleLogs = []; const errors = []
    ws.on('message', (d) => {
      let m; try { m = JSON.parse(d.toString()) } catch { return }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Runtime.consoleAPICalled') {
        consoleLogs.push(`[${m.params.type}] ` + (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '))
      }
      if (m.method === 'Runtime.exceptionThrown') {
        const e = m.params.exceptionDetails
        errors.push((e.exception && (e.exception.description || e.exception.value)) || e.text)
      }
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        errors.push('[Log] ' + m.params.entry.text + ' ' + (m.params.entry.url || ''))
      }
    })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text) + '>>'
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 100; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(2500); return } } }
    await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable')

    // ══ ① 登录页运行时检查 ══
    await nav(`${BASE}/admin/login/sys`)
    console.log('== ① 登录页 ==')
    console.log(' typeof $.mainu          =', await ev(`typeof window.jQuery!=='undefined' ? typeof jQuery.mainu : 'no-jq'`))
    console.log(' $().ajaxForm            =', await ev(`typeof jQuery.fn.ajaxForm`))
    console.log(' form action             =', await ev(`document.getElementById('form').action`))
    console.log(' 页面JS异常数            =', errors.length, errors.slice(0, 3))
    errors.length = 0

    // 填表提交(登录,用户授权)
    await ev(`(function(){
      function set(sel,v){var el=document.querySelector(sel);if(!el)return;
        var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,v);
        el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
      set('#companyid',${JSON.stringify(process.env.ASP_COMPANY || '0')});set('#username',${JSON.stringify(process.env.ASP_USER || 'Admin')});set('#password',${JSON.stringify(process.env.ASP_PASS || '')});return 'filled'})()`)
    await ev(`document.querySelector('#form input[type=submit]').click()`)
    await sleep(4000)
    console.log(' 提交后URL =', await ev('location.href'))
    console.log(' 登录后JS异常 =', errors.length, errors.slice(0, 3)); errors.length = 0

    // ══ ② /admin 主框架 ══
    if (!/\/admin\/?$/.test(String(await ev('location.pathname')))) { await nav(`${BASE}/admin`) }
    console.log('== ② /admin 主框架 ==')
    console.log(' 一级导航(顶栏) =', JSON.stringify(await ev(`Array.from(document.querySelectorAll('.navbar-levelone a')).map(a=>a.textContent.trim())`)))
    console.log(' 侧栏模块数     =', await ev(`document.querySelectorAll('.Hui-aside .menu_dropdown').length`))
    console.log(' 菜单项总数     =', await ev(`document.querySelectorAll('.Hui-aside a[data-href]').length`))
    console.log(' 默认iframe     =', await ev(`document.querySelector('#iframe_box iframe')?.src`))
    console.log(' 用户名显示     =', await ev(`document.querySelector('#Hui-userbar li a.dropDown_A')?.textContent.trim()`))

    // 点击侧栏一个菜单(只读 GET 页)验证 tab+iframe 机制
    console.log('== ③ 菜单点击→tab+iframe ==')
    await ev(`document.querySelector('.Hui-aside a[data-href="/BasCust/List"]').click()`)
    await sleep(3500)
    console.log(' tab列表        =', JSON.stringify(await ev(`Array.from(document.querySelectorAll('#min_title_list li span')).map(s=>s.textContent.trim())`)))
    console.log(' iframe数       =', await ev(`document.querySelectorAll('#iframe_box iframe').length`))
    console.log(' 各iframe src   =', JSON.stringify(await ev(`Array.from(document.querySelectorAll('#iframe_box iframe')).map(f=>f.src)`)))
    // 切回第一个 tab(点击 welcome tab),验证切换逻辑
    await ev(`document.querySelectorAll('#min_title_list li span')[0].click()`)
    await sleep(800)
    console.log(' 切回后可见iframe=', await ev(`Array.from(document.querySelectorAll('#iframe_box .show_iframe')).map(d=>getComputedStyle(d).display).join(',')`))

    // ══ ④ welcome iframe 内部(echarts) ══
    console.log('== ④ welcome 首页 ==')
    const frames = await send('Page.getFrameTree')
    const kids = []
    ;(function walk(ft) { (ft.childFrames || []).forEach((c) => { kids.push(c.frame.url); walk(c) }) })(frames.result.frameTree)
    console.log(' 子frame        =', JSON.stringify(kids))
    // 切到 BasCust tab 验证 EasyUI datagrid 行数
    await ev(`document.querySelectorAll('#min_title_list li span')[1].click()`)
    await sleep(1500)
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
    const listTab = targets.find((t) => t.type === 'page' && /BasCust/.test(t.url))
    console.log('== ⑤ BasCust 子页(EasyUI) ==')
    if (listTab) {
      const ws2 = new WebSocket(listTab.webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws2.onopen = res; ws2.onerror = rej })
      let s2 = 0; const p2 = new Map()
      ws2.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && p2.has(m.id)) { p2.get(m.id)(m); p2.delete(m.id) } })
      const send2 = (method, params = {}) => new Promise((res) => { const id = ++s2; p2.set(id, res); ws2.send(JSON.stringify({ id, method, params })) })
      const ev2 = async (exp) => { const r = await send2('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
      await send2('Runtime.enable')
      await sleep(1500)
      console.log(' url            =', await ev2('location.pathname'))
      console.log(' datagrid行数   =', await ev2(`document.querySelectorAll('#tt.datagrid-view .datagrid-body tr').length || document.querySelectorAll('#tt tbody tr').length`))
      console.log(' 共有数据(HTML) =', await ev2(`(document.body.innerText.match(/共有数据：(\\d+)/)||[])[1]`))
      console.log(' 工具条按钮     =', JSON.stringify(await ev2(`Array.from(document.querySelectorAll('.easyui-linkbutton,.easyui-menubutton')).map(b=>b.textContent.trim()).filter(Boolean)`)))
      ws2.close()
    } else { console.log(' 未找到 BasCust 子frame') }

    console.log('== console/errors ==')
    console.log(' console条数 =', consoleLogs.length, consoleLogs.slice(0, 10))
    console.log(' 异常条数 =', errors.length, errors.slice(0, 10))
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
}
main().catch((e) => { console.error(e); process.exit(1) })
