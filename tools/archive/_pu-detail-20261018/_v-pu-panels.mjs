/* 一次性探针(2026-10-18):采购订单明细表 PU_ORDER_DETAIL / 统计表 PU_ORDER_STATS
 *   —— 接口能查、列头齐全、数据非空;并截图留档。
 * 用法:node tools/archive/_pu-detail-20261018/_v-pu-panels.mjs [前端地址,默认 5173]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API = 'http://127.0.0.1:8090/api'
const APP = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:5173').replace(/\/$/, '')
const PORT = 9391
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const post = async (url, body, token) => {
  const r = await fetch(API + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  })
  const t = await r.text()
  let j = null; try { j = JSON.parse(t) } catch { /* */ }
  return { status: r.status, j, t }
}
let fail = 0
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail++ }

const login = await post('/auth/login', { userName: 'admin', password: '123456' })
const token = login.j?.data?.token
if (!token) { console.log('登录失败', login.t.slice(0, 200)); process.exit(1) }

for (const [code, label, expectCols] of [
  ['PU_ORDER_DETAIL', '采购订单明细表', ['单据日期', '单据编号', '供应商', '物料编码', '物料名称', '数量', '含税金额']],
  ['PU_ORDER_STATS', '采购订单统计表', ['供应商', '物料编码', '物料名称', '订单数', '数量', '金额', '平均单价']],
]) {
  const q = await post('/px/queryFormDataList', { panelCode: code, keyword: '', condition: {}, pageNo: 1, pageSize: 50 }, token)
  if (q.status !== 200 || q.j?.code !== 200) { check(false, `${label} 查询失败: ${q.t.slice(0, 300)}`); continue }
  const rows = q.j.data.list || []
  check(q.j.data.totalSize > 0 && rows.length > 0, `${label} 有数据: 共 ${q.j.data.totalSize} 行,本页 ${rows.length} 行`)
  const keys = Object.keys(rows[0] || {})
  for (const c of expectCols) check(keys.includes(c), `${label} 列「${c}」存在`)
  const sample = expectCols.map((c) => `${c}=${rows[0]?.[c]}`).join(' ')
  console.log(`      样例: ${sample}`)
}

// 页面截图
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-pu-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1000',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
try {
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pending = new Map()
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const raw = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i = 0; i < 80; i++) { await sleep(300); if (await raw('document.readyState') === 'complete') { await sleep(2000); return } } }
  await send('Page.enable'); await send('Runtime.enable')
  await nav(`${APP}/#/login`); await sleep(1500)
  // 左栏有折叠态:mes_collapsed=1 时二级 .nav-module 根本不渲染(之前探针拿到空数组就是这个)。
  // 这里显式置成"展开 + 手风琴模式",保证二级菜单可见。
  await raw(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
             localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.j.data.user))});
             localStorage.setItem('mes_collapsed', '0');
             localStorage.setItem('mes_menu_mode', 'accordion'); 'ok'`)
  await nav('about:blank')
  await nav(`${APP}/#/dashboard`); await sleep(4000)
  for (const [code, file] of [['PU_ORDER_DETAIL', '_shot-pu-detail.png'], ['PU_ORDER_STATS', '_shot-pu-stats.png']]) {
    await raw(`location.hash = '#/panelx/list/${code}'; 'ok'`)
    await sleep(9000)
    const heads = await raw(`[...document.querySelectorAll('.el-table__header th .cell')].map(e=>e.innerText.trim().replace(/\\s+/g,'')).filter(Boolean).slice(0,20)`)
    const n = await raw(`document.querySelectorAll('.el-table__body tr.el-table__row').length`)
    console.log(`[页面 ${code}] 列头 ${JSON.stringify(heads)}`)
    check(n > 0, `[页面 ${code}] 渲染 ${n} 行`)
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(__dirname, file), Buffer.from(shot.result.data, 'base64'))
  }
  // 菜单:采购管理下应有 采购订单/明细表/统计表。
  // 进 dashboard 后左栏可能还没渲染完(之前直接查拿到空数组),故轮询等它出现再操作。
  await raw(`location.hash = '#/dashboard'; 'ok'`)
  let groups = []
  for (let i = 0; i < 30; i++) {
    await sleep(500)
    groups = (await raw(`[...document.querySelectorAll('.leftnav .nav-group')].map(e => e.innerText.trim())`)) || []
    if (groups.includes('智能供应链')) break
  }
  check(groups.includes('智能供应链'), `左栏渲染出一级目录(${JSON.stringify(groups)})`)
  // 侧栏「采购管理 → 单据/明细表/统计表」的展开与悬浮卡片断言,
  // 交给专用探针 tools/archive/_menu-inventory-split-20261018/_v-leftnav.cjs(它登录后停在 dashboard
  // 再点开分组,hover 卡片稳定;本探针前面刚在功能页之间跳转,左栏重挂载时机不稳,别在这里重复造轮子)。
  console.log('      侧栏采购管理结构请跑: node tools/archive/_menu-inventory-split-20261018/_v-leftnav.cjs')
} finally { edge.kill() }
console.log(fail ? `\n${fail} 项未通过` : '\n全部通过')
process.exit(fail ? 1 : 0)
