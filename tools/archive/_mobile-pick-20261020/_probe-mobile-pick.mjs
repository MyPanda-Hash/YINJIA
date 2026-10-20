/**
 * _probe-mobile-pick.mjs — 移动端扫码领料页 /#/m/pick 的 375 宽验收探针(只读)
 *
 * 验什么(对应 2026-10-20 用户口径 + 规范):
 *   ① 375 宽不横向滚动(docs/frontend/前端面板设计.md §10 / 补充设计 §4.4);
 *   ② 扫工单(手输/扫码枪回车)→ 工单卡出来(工单号/产品/产线/排产数量);
 *   ③ 扫物料 → 可用量(物料+仓库合计);
 *   ④ 填数量 → 按批号日期先进先出的分配预览;
 *   ⑤ 加入 → 领料清单有行;
 *   ⑥ 截图留档。
 *   ⚠ **不点提交**(不往正式库造草稿单)。
 *
 * 用法(5173 或 8090 均可,前提是后端在跑):
 *   node tools/archive/_mobile-pick-20261020/_probe-mobile-pick.mjs [uiBase] [工单号] [物料编码] [数量]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const UI = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '')
const WO = process.argv[3] || 'GD-2026-10-0222'
const MAT = process.argv[4] || 'A-32-01'
const QTY = process.argv[5] || '2'
// 2026-10-20:同一个组件两端共用 —— 手机端 /#/m/pick(独立布局)· 电脑端 /#/prod/plan/prodPick(桌面壳内双栏)
const ROUTE = process.env.PROBE_ROUTE || '/#/m/pick'
const W = Number(process.env.PROBE_W || 375)
const H = Number(process.env.PROBE_H || 900)
const PORT = 9411
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const apiBase = UI.includes(':5173') ? 'http://127.0.0.1:8090' : UI
const lg = await (await fetch(apiBase + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: process.env.PROBE_FACTORY || 'YJ' }),
})).json()
if (!lg?.data?.token) throw new Error('登录失败: ' + JSON.stringify(lg).slice(0, 200))

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-mpick-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=' + W + ',' + H,
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
let tab
for (let i = 0; i < 30 && !tab; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch {}
  if (!tab) await sleep(500)
}
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0
const pending = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }))?.result?.result?.value

await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable')
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: W < 600 })
await send('Page.navigate', { url: `${UI}/#/login` }); await sleep(1800)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))}); 'ok'`)
await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
await send('Page.navigate', { url: UI + ROUTE }); await sleep(4500)

const out = []
const ok = (name, pass, detail = '') => { out.push({ name, pass, detail }); console.log(`${pass ? '  ✔' : '  ✘'} ${name}${detail ? '  ' + detail : ''}`) }

// ① 布局
const layout = JSON.parse(await ev(`JSON.stringify({
  win: window.innerWidth,
  doc: document.documentElement.scrollWidth,
  body: document.body.scrollWidth,
  title: document.querySelector('.mp-title')?.textContent || '',
  cards: document.querySelectorAll('.mp-card').length,
  cols: getComputedStyle(document.querySelector('.mp-body') || document.body).display,
  leftW: Math.round((document.querySelector('.mp-left')?.getBoundingClientRect().width) || 0),
  rightW: Math.round((document.querySelector('.mp-right')?.getBoundingClientRect().width) || 0),
  footPos: getComputedStyle(document.querySelector('.mp-foot') || document.body).position,
  menuHasPick: Array.from(document.querySelectorAll('.leftnav, .mobile-nav')).some(n => (n.textContent || '').includes('生产领料')),
  isPanelShell: !!document.querySelector('.pl-toolbar, .panelx-toolbar') && !document.querySelector('.mp'),
})`))
ok('页面已渲染(.mp-title=' + layout.title + ')', layout.title.length > 0, `cards=${layout.cards}`)
ok(`${W} 宽无横向滚动`, layout.doc <= layout.win && layout.body <= layout.win, `doc=${layout.doc} win=${layout.win}`)
if (W >= 900) {
  ok('电脑端双栏(grid)且左右都有宽度', layout.cols === 'grid' && layout.leftW > 0 && layout.rightW > 0, JSON.stringify({ cols: layout.cols, leftW: layout.leftW, rightW: layout.rightW }))
  ok('电脑端底栏不再 fixed(留在内容流里)', layout.footPos !== 'fixed', layout.footPos)
  ok('左侧菜单能看到「生产领料」', layout.menuHasPick === true, String(layout.menuHasPick))
} else {
  // 统一地址后:手机端也是桌面壳(有顶栏/抽屉导航),页脚改成 flex 贴底(不再 position:fixed)
  ok('手机端单列 + 页脚在内容流里贴底', layout.cols === 'block' && layout.footPos !== 'fixed', JSON.stringify({ cols: layout.cols, footPos: layout.footPos }))
  ok('推入面板目录地址后仍在生产领料页(不是通用面板壳)', layout.isPanelShell === false, String(layout.isPanelShell))
}

// ② 工单
const setInput = async (sel, val) => ev(`(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return 'no-input';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, ${JSON.stringify(val)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return 'ok';
})()`)
const clickBtn = async (text) => ev(`(() => {
  const b = Array.from(document.querySelectorAll('.mp button')).find(x => (x.textContent||'').trim() === ${JSON.stringify(text)});
  if (!b) return 'no-btn';
  b.click(); return 'ok';
})()`)

await setInput('.mp-card .el-input__inner', WO)
await clickBtn('查询')
await sleep(2500)
const woCard = JSON.parse(await ev(`JSON.stringify({
  text: document.querySelector('.mp-wo')?.innerText || '',
  rows: document.querySelectorAll('.mp-kv').length,
})`))
ok('扫工单 → 工单卡出现', woCard.text.includes(WO) && woCard.rows >= 4, JSON.stringify(woCard).slice(0, 160))

// ③ 物料
const inputs = await ev(`document.querySelectorAll('.mp-card .el-input__inner').length`)
await ev(`(() => {
  const els = document.querySelectorAll('.mp-card .el-input__inner');
  const el = els[els.length - 1];
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, ${JSON.stringify(MAT)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return 'ok';
})()`)
await ev(`(() => {
  const b = Array.from(document.querySelectorAll('.mp button')).filter(x => (x.textContent||'').trim() === '查询');
  (b[b.length - 1] || b[0]).click(); return 'ok';
})()`)
await sleep(2500)
const matBlock = JSON.parse(await ev(`JSON.stringify({
  text: document.querySelector('.mp-mat')?.innerText || '',
  stock: document.querySelector('.mp-mat-stock b')?.textContent || '',
})`))
if (!matBlock.text) {
  const dbg = await ev(`JSON.stringify({
    err: document.querySelector('.mp-err')?.textContent || '',
    inputs: document.querySelectorAll('.mp-card .el-input__inner').length,
    btns: Array.from(document.querySelectorAll('.mp button')).map(b => (b.textContent||'').trim()),
  })`)
  console.log('  [DBG] ' + dbg)
}
ok('扫物料 → 可用量出现', matBlock.text.includes(MAT) && matBlock.stock.trim() !== '', JSON.stringify(matBlock).slice(0, 160))

// ④ 数量 → FIFO 预览
await ev(`(() => {
  const el = document.querySelector('.mp-qty .el-input__inner');
  if (!el) return 'no-qty';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, ${JSON.stringify(QTY)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
  return 'ok';
})()`)
await sleep(900)
const alloc = JSON.parse(await ev(`JSON.stringify({
  rows: document.querySelectorAll('.mp-alloc-row').length,
  warn: document.querySelector('.mp-warn')?.textContent || '',
})`))
ok('填数量 → 先进先出分配预览', alloc.rows > 0, JSON.stringify(alloc))

// ⑤ 加入清单
await clickBtn('加入')
await sleep(800)
const list = JSON.parse(await ev(`JSON.stringify({
  lines: document.querySelectorAll('.mp-line').length,
  text: document.querySelector('.mp-line')?.innerText || '',
})`))
ok('加入 → 领料清单有行', list.lines > 0, JSON.stringify(list).slice(0, 160))

// ⑤b 提交(仅 --submit;测试账套用)
if (process.argv.includes('--submit')) {
  await clickBtn('生成材料出库单')
  await sleep(3000)
  const msg = await ev(`(() => {
    const boxes = Array.from(document.querySelectorAll('.el-message'));
    return boxes.map(b => (b.textContent||'').trim()).join(' | ');
  })()`)
  const errBox = await ev(`document.querySelector('.mp-err')?.textContent || ''`)
  ok('提交 → 生成草稿', /已生成材料出库单草稿/.test(msg || ''), (msg || errBox || '(无提示)').slice(0, 120))
  await sleep(600)
}


const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
const file = path.join(process.cwd(), 'tools', 'archive', '_mobile-pick-20261020',
  W < 600 ? 'mobile-pick-375.png' : 'prod-pick-desktop.png')
fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'))
console.log(`\n截图: ${file}`)

const pass = out.filter((x) => x.pass).length
console.log(`\n=== ${pass}/${out.length} 通过 ===`)
try { edge.kill() } catch {}
process.exit(pass === out.length ? 0 : 1)
