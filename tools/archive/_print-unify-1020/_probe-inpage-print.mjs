#!/usr/bin/env node
/**
 * 页面内打印探针(2026-10-20) —— 验证「商品/仓位标识卡、采购单据、二维码标签」全部走
 * **主页面打印层 + window.print()**,不再开子窗口,也不再把主页面拖死。
 *
 * 做法:headless Edge + CDP 打开 5173 的 INV(商品)面板 → 注入 token → 在页面里
 *   ① 把 window.print 换成计数器(不会真的弹打印对话框,不打断用户);
 *   ② 依次调用 printProductCards / printLocationCards / printPuOrder(以及 QrLabelDialog 用的 printChannel);
 *   ③ 断言:有 #yj-print-host、卡面里有二维码 data URL、window.print 被调用、afterprint 后层被摘掉;
 *   ④ 断言:`/json/list` 里的页面数**没有变化** = 没开新窗口;
 *   ⑤ 打印完 ping 主线程 8 次,最长 ≤1500ms = 页面没有卡死;
 *   ⑥ 顺带 `import('/src/core/views/QrLabelDialog.vue')` 编译检查(SFC 真正能加载)。
 *
 * 用法: node tools/archive/_print-unify-1020/_probe-inpage-print.mjs [http://127.0.0.1:5173] [账号] [口令]
 * 安全:只读探针 —— 只调用本地打印函数(print 已被 stub),不点保存/审核,不写任何业务数据。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const URL_ = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '')
const USER = process.argv[3] || 'admin'
const PASS = process.argv[4] || '123456'
// 端口避开 Windows 保留段(9181-9380/9481-9680 等),见开发与质量.md §5.5 E17
const PORT = 9460
const PROFILE = path.join(os.tmpdir(), 'edge-print-probe-' + PORT)
const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]
const EDGE = EDGE_CANDIDATES.find((p) => fs.existsSync(p))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`)
}

if (!EDGE) {
  console.log('[FAIL] 找不到 Edge 可执行文件')
  process.exit(2)
}

// ── 登录拿 token ───────────────────────────────────────────────────────────
const lr = await fetch(`${URL_}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: USER, password: PASS }),
  signal: AbortSignal.timeout(20000),
}).then((r) => r.json()).catch((e) => ({ message: String(e) }))
const token = lr?.data?.token || lr?.token
const userJson = JSON.stringify(lr?.data?.user || lr?.user || {})
check('登录 ' + URL_, !!token, token ? '' : JSON.stringify(lr).slice(0, 200))
if (!token) process.exit(1)

const edge = spawn(EDGE, ['--headless=new', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-background-networking', '--disable-popup-blocking',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'],
{ stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
let edgeErr = ''
edge.stderr?.on('data', (d) => { edgeErr += String(d) })

let ws = null
let id = 0
const pending = new Map()
const send = (method, params = {}) => new Promise((res, rej) => {
  const msg = { id: ++id, method, params }
  pending.set(msg.id, { res, rej })
  ws.send(JSON.stringify(msg))
})
const evalIn = async (expression, awaitPromise = false) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'evaluate failed')
  return r.result?.value
}
const pages = async () => (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json())
  .filter((t) => t.type === 'page')

try {
  let up = false
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) { up = true; break } } catch {}
    await sleep(250)
  }
  if (!up) throw new Error('Edge 调试端口没起来(沙箱可能拦住浏览器启动)。stderr: ' + edgeErr.slice(0, 400))

  const tgt = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  ws = new WebSocket(tgt.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id)
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result)
    }
  }
  await send('Runtime.enable')
  await send('Page.enable')
  const consoleErrors = []
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(m.params?.exceptionDetails?.exception?.description || 'exception')
    }
  })

  // 先落 token 再进面板(E6:同文档 hash 跳转不重载,必须先真加载一次)
  await send('Page.navigate', { url: URL_ + '/?probe=1' })
  await sleep(2500)
  await evalIn(`localStorage.setItem('mes_token', ${JSON.stringify(token)});`
    + `localStorage.setItem('mes_user', ${JSON.stringify(userJson)});'ok'`)
  await send('Page.navigate', { url: URL_ + '/#/panelx/list/INV' })
  await sleep(8000)

  const boot = await evalIn('!document.querySelector("#boot-tip") && !!document.querySelector(".el-table")')
  check('INV(商品)面板已渲染(无启动占位 + 有表格)', boot === true, String(boot))

  const before = (await pages()).length

  // ① 商品标识卡(INV「二维码标签」同一条调用)
  const r1 = await evalIn(`(async () => {
    window.__p = { printed: 0 }
    window.print = () => { window.__p.printed++ }
    const m = await import('/src/business/print-formats.js')
    const ok = await m.printProductCards([
      { 编码: 'YJ-TS-004', 规格: '44.1*28.7*215.5' },
      { 编码: 'YJ-TS-005', 规格: '2-3mm', 批次: '20261020', 数量: 8 },
    ])
    await new Promise((r) => setTimeout(r, 200))  // window.print() 在 requestAnimationFrame 里,等它真跑到
    const host = document.getElementById('yj-print-host')
    const out = {
      ok, printed: window.__p.printed, host: !!host,
      png: (host?.innerHTML || '').includes('data:image/png'),
      hasPageRule: (host?.innerHTML || '').includes('75mm 100mm'),
      title: document.title,
      css: !!document.getElementById('yj-print-host-css'),
      screenHidden: !!host && getComputedStyle(host).display === 'none',
    }
    window.dispatchEvent(new Event('afterprint'))
    out.hostAfter = !!document.getElementById('yj-print-host')
    out.cssAfter = !!document.getElementById('yj-print-host-css')
    out.titleAfter = document.title
    return out
  })()`, true)
  check('商品标识卡:走页面内打印(window.print 调用 1 次)', r1?.printed === 1, JSON.stringify(r1))
  check('商品标识卡:打印层 + 二维码 + 75×100mm @page 都在', !!(r1?.host && r1?.png && r1?.hasPageRule), '')
  check('商品标识卡:屏幕上不可见(display:none,不闪屏)', r1?.screenHidden === true, '')
  check('商品标识卡:afterprint 后层/CSS 摘掉、标题还原', r1?.hostAfter === false && r1?.cssAfter === false && r1?.titleAfter !== r1?.title, JSON.stringify({ h: r1?.hostAfter, c: r1?.cssAfter, t: r1?.titleAfter }))

  // ② 仓位标识卡(WHLOC「二维码标签」同一条调用)
  const r2 = await evalIn(`(async () => {
    const m = await import('/src/business/print-formats.js')
    const ok = await m.printLocationCards([{ 仓库: '原料仓', 仓库编码: 'CK01', 仓位地址: 'A区3排2层', 仓位编码: 'KW-0001' }])
    await new Promise((r) => setTimeout(r, 200))
    const host = document.getElementById('yj-print-host')
    const out = { ok, printed: window.__p.printed, png: (host?.innerHTML || '').includes('data:image/png') }
    window.dispatchEvent(new Event('afterprint'))
    out.hostAfter = !!document.getElementById('yj-print-host')
    return out
  })()`, true)
  check('仓位标识卡:页面内打印 + 二维码出图', r2?.printed === 2 && r2?.png === true && r2?.hostAfter === false, JSON.stringify(r2))

  // ③ 采购订单(单据版式)
  const r3b = await evalIn(`(async () => {
    const m = await import('/src/business/print-formats.js')
    window.__p.printed = 0
    m.printPuOrder({ 单据编号: 'PO-PROBE-0001', 单据日期: '2026-10-20', 供应商: '探针供应商' },
      [{ 物料编码: 'M-001', 物料名称: '物料A', 规格型号: 'Φ20', 单价: 1.5, 单位: '支', 数量: 10, 金额: 15 }])
    await new Promise((r) => setTimeout(r, 200))
    const host = document.getElementById('yj-print-host')
    const out = { printed: window.__p.printed, hasTable: (host?.innerHTML || '').includes('<h1>银嘉采购订单</h1>') }
    window.dispatchEvent(new Event('afterprint'))
    out.hostAfter = !!document.getElementById('yj-print-host')
    return out
  })()`, true)
  check('采购订单:页面内打印(A4 @page 随单据一起进层)', r3b?.printed === 1 && r3b?.hasTable === true && r3b?.hostAfter === false, JSON.stringify(r3b))

  // ④ QrLabelDialog(二维码标签弹窗)本身能编译加载
  const r4 = await evalIn(`(async () => {
    try { const c = await import('/src/core/views/QrLabelDialog.vue'); return { ok: !!c.default, name: c.default?.name || c.default?.__name || '' } }
    catch (e) { return { ok: false, err: String(e) } }
  })()`, true)
  check('QrLabelDialog(SFC)可编译加载', r4?.ok === true, JSON.stringify(r4))

  // ⑤ 打印通道直调(材料码/二维码标签共用的那一条)
  const r5 = await evalIn(`(async () => {
    const { printInPage } = await import('/src/core/panel/printChannel.js')
    window.__p.printed = 0
    const ok = printInPage('探针标签', '<style>@page{size:A4;margin:8mm}</style><div class="qrg">x</div>')
    await new Promise((r) => setTimeout(r, 200))
    const host = document.getElementById('yj-print-host')
    const out = { ok, printed: window.__p.printed, host: !!host, text: (host?.innerHTML || '').includes('探针标签') === false && (host?.innerHTML || '').includes('qrg') }
    window.dispatchEvent(new Event('afterprint'))
    out.hostAfter = !!document.getElementById('yj-print-host')
    return out
  })()`, true)
  check('打印通道:直调可用 + afterprint 清理', r5?.ok === true && r5?.printed === 1 && r5?.hostAfter === false, JSON.stringify(r5))

  // ⑥ 没有开新窗口
  const after = (await pages()).length
  check('全程没有开新窗口(window.open 打印已废弃)', after === before, `pages ${before} → ${after}`)

  // ⑦ printToPDF 落纸验证:3 张 75×100mm 标识卡 = 3 页、每页 75×100mm(页面内打印必须真的按标签纸出纸)
  await evalIn(`(async () => {
    const m = await import('/src/business/print-formats.js')
    await m.printProductCards([{ 编码: 'PDF-A1' }, { 编码: 'PDF-A2' }, { 编码: 'PDF-A3' }])
    await new Promise((r) => setTimeout(r, 300))
    return !!document.getElementById('yj-print-host')
  })()`, true)
  const pdfB64 = await send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true })
    .then((p) => p?.data).catch(() => null)
  if (!pdfB64) {
    check('printToPDF 落纸验证', false, 'Page.printToPDF 无返回')
  } else {
    const pdf = Buffer.from(pdfB64, 'base64')
    const buf = pdf.toString('latin1')
    const pageCount = (buf.match(/\/Type\s*\/Page[^s]/g) || []).length
    const box = (buf.match(/\/MediaBox\s*\[([^\]]+)\]/) || [])[1] || ''
    const [, , w, h] = box.trim().split(/\s+/).map(Number)
    const mm = (v) => Math.round((v / 72) * 25.4)
    const okSize = Math.abs(mm(w) - 75) <= 1 && Math.abs(mm(h) - 100) <= 1
    check('printToPDF:3 张卡 = 3 页且每页 75×100mm',
      pageCount === 3 && okSize, `pages=${pageCount} MediaBox=${box} → ${mm(w)}×${mm(h)}mm`)
    const out = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '_out-cards.pdf')
    try { fs.writeFileSync(out, pdf); console.log('  ↳ 样张已存:' + out) } catch { /* 忽略 */ }
  }
  await evalIn(`window.dispatchEvent(new Event('afterprint')); !document.getElementById('yj-print-host')`, false)

  // ⑧ 版面目视:切到 print 媒体截图(证明层里就是卡面、主界面被隐藏),存 PNG 供人看
  await evalIn(`(async () => {
    const m = await import('/src/business/print-formats.js')
    await m.printProductCards([
      { 编码: 'YJ-TS-004', 规格: '44.1*28.7*215.5', 订单编号: 'YJ-20261020-01', 供应商名称: '探针供应商', 数量: 8, 批次: '20261020' },
      { 编码: 'YJ-TS-005', 规格: '2-3mm' },
    ])
    await new Promise((r) => setTimeout(r, 400))
    return true
  })()`, true)
  await send('Emulation.setEmulatedMedia', { media: 'print' }).catch(() => {})
  await sleep(500)
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }).catch(() => null)
  await send('Emulation.setEmulatedMedia', { media: 'screen' }).catch(() => {})
  if (shot?.data) {
    const shotPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '_out-print-layer.png')
    try { fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64')); console.log('  ↳ 版式截图已存:' + shotPath) } catch { /* 忽略 */ }
    check('print 媒体截图已生成(卡面 + 主界面隐藏)', shot.data.length > 1000, `b64=${shot.data.length}`)
  } else {
    check('print 媒体截图已生成', false, 'Page.captureScreenshot 无返回')
  }
  await evalIn(`window.dispatchEvent(new Event('afterprint')); !document.getElementById('yj-print-host')`, false)

  // ⑨ 打印后主线程不受影响
  let worst = 0
  for (let i = 0; i < 8; i++) {
    const p0 = Date.now()
    await evalIn('1+1').catch(() => {})
    worst = Math.max(worst, Date.now() - p0)
    await sleep(150)
  }
  check('打印后主线程 ping 正常(最长 ≤1500ms)', worst <= 1500, `worst=${worst}ms`)
  check('全程无未捕获异常', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))
} catch (e) {
  check('探针执行', false, e.message)
} finally {
  try { ws?.close() } catch {}
  try { edge.kill() } catch {}
  await sleep(500)
  try { fs.rmSync(PROFILE, { recursive: true, force: true }) } catch {}
  const pass = results.filter((r) => r.ok).length
  console.log(`\n=== ${pass}/${results.length} PASS ===`)
  process.exit(pass === results.length ? 0 : 1)
}
