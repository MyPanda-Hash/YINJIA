// _aspmis-probe/runtime2-probe.cjs — 补充运行时验证(只读)
// ① {"state":"error"} console.info 的调用栈归属 ② welcome iframe echarts canvas 渲染
// ③ BasCust 子 iframe 内 EasyUI datagrid 实际行数 ④ 页面加载自动 POST 的接口清单(Network域)
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('../../node_modules/ws')
const PORT = 9462
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'https://www.aspmis.com:160'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-asp2-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1200',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    const reqs = []; const infoStacks = []
    ws.on('message', (d) => {
      let m; try { m = JSON.parse(d.toString()) } catch { return }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'info') {
        const txt = (m.params.args || []).map((a) => a.value ?? '').join(' ')
        if (/state/.test(txt)) infoStacks.push({ txt, stack: (m.params.stackTrace?.callFrames || []).slice(0, 3).map((f) => `${f.url}:${f.lineNumber}`) })
      }
      if (m.method === 'Network.requestWillBeSent') {
        const rq = m.params.request
        if (rq.method === 'POST') reqs.push({ url: rq.url, data: (rq.postData || '').slice(0, 120) })
      }
    })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result?.exceptionDetails) return '<<EVAL-ERR ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text) + '>>'
      return r.result?.result?.value
    }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 100; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3000); return } } }
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

    await nav(`${BASE}/admin/login/sys`)
    await ev(`(function(){function set(s,v){var e=document.querySelector(s);if(!e)return;
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(e,v);
      e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}
      set('#companyid',${JSON.stringify(process.env.ASP_COMPANY || '0')});set('#username',${JSON.stringify(process.env.ASP_USER || 'Admin')});set('#password',${JSON.stringify(process.env.ASP_PASS || '')});return 'ok'})()`)
    await ev(`document.querySelector('#form input[type=submit]').click()`)
    await sleep(5000)
    console.log('URL =', await ev('location.href'))

    // 打开 BasCust 菜单(触发 tab+iframe)
    await ev(`document.querySelector('.Hui-aside a[data-href="/BasCust/List"]').click()`)
    await sleep(5000)

    console.log('== ① {"state":"error"} 来源 ==')
    for (const s of infoStacks) console.log(' ', s.txt, '<-', s.stack)

    console.log('== ② welcome iframe ==')
    console.log(' echarts canvas数 =', await ev(`(function(){var f=document.querySelectorAll('#iframe_box iframe')[0];
      if(!f||!f.contentDocument)return 'no-frame';return f.contentDocument.querySelectorAll('#container canvas').length})()`))
    console.log(' 图表数据点(硬编码)=', await ev(`(function(){var f=document.querySelectorAll('#iframe_box iframe')[0];
      if(!f||!f.contentDocument)return null;var m=f.contentDocument.body.innerText.match(/直接访问/);return !!m})()`))

    console.log('== ③ BasCust iframe ==')
    console.log(' URL       =', await ev(`(function(){var f=document.querySelectorAll('#iframe_box iframe')[1];return f&&f.contentDocument?f.contentDocument.location.pathname:'n/a'})()`))
    console.log(' tbody行数 =', await ev(`(function(){var f=document.querySelectorAll('#iframe_box iframe')[1];
      if(!f||!f.contentDocument)return 'no-frame';return f.contentDocument.querySelectorAll('#tt tbody tr').length})()`))
    console.log(' 行数据首行=', await ev(`(function(){var f=document.querySelectorAll('#iframe_box iframe')[1];
      if(!f||!f.contentDocument)return null;var tds=f.contentDocument.querySelectorAll('#tt tbody tr:first-child td');
      return Array.from(tds).slice(0,6).map(t=>t.textContent.trim())})()`))

    console.log('== ④ 会话期间全部 POST 请求 ==')
    const seen = new Set()
    for (const r of reqs) { const k = r.url + r.data; if (seen.has(k)) continue; seen.add(k); console.log(' POST', r.url, '|', r.data) }

    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
}
main().catch((e) => { console.error(e); process.exit(1) })
