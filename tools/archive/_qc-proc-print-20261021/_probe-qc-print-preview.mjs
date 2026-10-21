/*
 * _probe-qc-print-preview.mjs — 「打印 / 打印预览 / 导出报表 PDF」三处出纸一致性验收(2026-10-21)
 *
 * 用户口径:「处理一下当前的报表渲染问题,打印处的格式应该和当前单据对应,修改当前打印预览的渲染方式,
 *   第一张图为打印预览的格式,第二张为原来的系统内实现的报表。」
 *
 * 验什么(CDP + Edge headless):
 *   ① 「打印」:print 媒体下纸张根 visibility=visible 且 printToPDF 出纸有内容(不再空白);
 *   ② 「导出报表 → 打印预览」:检验单类**不再走 .jrxml**,而是把当前纸张截成 PDF
 *      —— 断言实现里没有走 fetchReportBlob(拦 /api/report/export 请求,零命中);
 *   ③ 首件检验单同样过一遍;
 *   ④ 普通面板(销售订单)的「导出报表 → 打印预览」**仍然**走服务端报表(不能被误伤)。
 *
 * 用法: node tools/archive/_qc-proc-print-20261021/_probe-qc-print-preview.mjs [base]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '')
const OUT = 'D:/workspace/yinjia/tools/archive/_qc-proc-print-20261021'
const PORT = 9507
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-pp-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000)
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ }
}
let ws = null
try {
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map(); const reportCalls = []
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
    if (m.method === 'Network.requestWillBeSent') {
      const u = m.params?.request?.url || ''
      if (u.includes('/api/report/export')) reportCalls.push(u)
    }
  }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value

  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
    localStorage.setItem('mes_user', ${JSON.stringify(login.data.user)});
    localStorage.setItem('mes_locale','zh-CN'); localStorage.setItem('mes_init_done','1'); 'ok'`)

  const openPanel = async (code, sel) => {
    await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/${code}` })
    for (let i = 0; i < 80; i++) { await sleep(500); if (await ev(`!!document.querySelector('${sel}')`)) break }
    await sleep(2800)
    await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说');if(b)b.click();
      const x=document.querySelector('.el-dialog__headerbtn');if(x)x.click();return 'ok'})()`)
    await sleep(800)
  }

  // ①② 两张检验单:打印非空白 + 打印预览不走 jrxml
  for (const [code, sel] of [['QC_PROC_INSP', '.qr-sheet'], ['QC_FIRST_INSP', '.fi-sheet']]) {
    console.log(`\n=== ${code} ===`)
    await openPanel(code, sel)

    // ① 打印
    await ev(`document.body.classList.add('approval-printing'); 'ok'`)
    await sleep(700)
    const vis = await ev(`getComputedStyle(document.querySelector('${sel}')).visibility`)
    const pdf = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true })
    const buf = Buffer.from(pdf.result?.data || '', 'base64')
    fs.writeFileSync(`${OUT}/print-${code}.pdf`, buf)
    ok('① 打印态纸张可见', vis === 'visible', vis)
    ok('① 出纸非空白(>100KB)', buf.length > 100_000, `${buf.length} bytes`)
    await ev(`document.body.classList.remove('approval-printing'); 'ok'`)
    await sleep(300)

    // ② 导出报表 → 打印预览:不该命中 /api/report/export
    reportCalls.length = 0
    await ev(`(()=>{const el=[...document.querySelectorAll('.approval-side .as-side-btn')].find(e=>(e.innerText||'').trim()==='导出报表');if(el)el.click();return 'ok'})()`)
    await sleep(1200)
    const dlgText = String(await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent&&(x.innerText||'').includes('导出报表'));return d?(d.innerText||'').replace(/\\s+/g,' '):'no-dialog'})()`))
    ok('② 弹出导出报表', dlgText.includes('导出报表'), dlgText.slice(0, 60))
    ok('② 文案已改为「纸张版式 / 所见即所得」', /所见即所得|纸张版式/.test(dlgText), dlgText.slice(0, 160))

    // 点「打印预览」(先拦 window.open,免得真开窗影响)
    await ev(`(()=>{window.__openedPdf=null; const orig=window.open; window.open=function(u){ if(u) window.__openedPdf=String(u); return { location:{ set href(v){ window.__openedPdf=String(v) } }, close(){}, document:{write(){},close(){}} } }; window.__origOpen=orig; return 'ok'})()`)
    await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent&&(x.innerText||'').includes('导出报表'));
      if(!d) return 'no-dialog'; const it=[...d.querySelectorAll('.efmt-item')].find(x=>(x.innerText||'').includes('打印预览')); if(!it) return 'no-item'; it.click(); return 'ok'})()`)
    await sleep(4000)
    const opened = await ev(`window.__openedPdf`)
    console.log(`  预览结果=${String(opened).slice(0, 40)}  report接口命中=${reportCalls.length}`)
    ok('② 打印预览**没有**请求 /api/report/export(不再走 jrxml)', reportCalls.length === 0, reportCalls.join(','))
    ok('② 打印预览产出了 blob/pdf 地址', /^blob:|^data:/.test(String(opened)), String(opened).slice(0, 60))
    await ev(`window.open=window.__origOpen; 'ok'`)
  }

  // ③ 普通面板不受影响(销售订单仍走服务端报表)
  console.log('\n=== SO_ORDER(回归:仍走服务端报表) ===')
  reportCalls.length = 0
  await openPanel('SO_ORDER', '.doc-rail-layout, .panelx-list')
  const hasReportBtn = await ev(`(()=>{const el=[...document.querySelectorAll('.approval-side .as-side-btn, .tools button, button')].find(e=>(e.innerText||'').trim()==='导出报表');if(!el)return false;el.click();return true})()`)
  await sleep(1200)
  if (hasReportBtn) {
    await ev(`(()=>{window.__openedPdf=null; const orig=window.open; window.open=function(u){ if(u) window.__openedPdf=String(u); return { location:{ set href(v){ window.__openedPdf=String(v) } }, close(){}, document:{write(){},close(){}} } }; window.__origOpen=orig; return 'ok'})()`)
    await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent&&(x.innerText||'').includes('导出报表'));
      if(!d) return 'no-dialog'; const it=[...d.querySelectorAll('.efmt-item')].find(x=>(x.innerText||'').includes('打印预览')); if(!it) return 'no-item'; it.click(); return 'ok'})()`)
    await sleep(3000)
    ok('③ 销售订单的打印预览仍请求服务端报表', reportCalls.length > 0, `命中 ${reportCalls.length}`)
    await ev(`window.open=window.__origOpen; 'ok'`)
  } else {
    console.log('  (销售订单没有「导出报表」按钮,跳过该回归项)')
  }
} finally {
  try { ws?.close() } catch { /* ignore */ }
  edge.kill()
}
console.log(`\n== 打印/打印预览 一致性:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
