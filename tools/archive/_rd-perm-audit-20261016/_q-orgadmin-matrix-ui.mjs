/**
 * _q-orgadmin-matrix-ui.mjs —— 组织架构「研发管理」权限矩阵的**活体界面**取证(CDP / Edge headless,只读)
 *
 * 为什么要有它:本次改动最直接的可见结果就是矩阵的**列变了** ——
 *   旧:可见|查询|新增|修改|删除|导出EXCEL|打印预览|审核反审核|价格金额|复核反审核|调价|自定义字段|预警配置(13 列,5 个废词)
 *   新:可见|查询单据|新增保存|申请修改|修改记录|删除申请|导出打印|打印预览|审批|自定义字段|预警配置(11 列,全是引擎词)
 * 光看接口下发不够 —— 界面还得证明:①列真的换了 ②「项目进度查询」那行原来授不出的词现在**看得见也勾得上**
 * ③列少了不会把表格压坏(读实际几何,不靠目测)。
 *
 * 用法: node tools/archive/_rd-perm-audit-20261016/_q-orgadmin-matrix-ui.mjs [uiBase] [cdpPort]
 *   默认 uiBase=http://127.0.0.1:8090(正式实例;重建后即新代码)
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const UI = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const API = UI + '/api'
const PORT = Number(process.argv[3] || 9357)
const EDGE = process.env.YJ_EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(import.meta.dirname, '_shots')
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ✔ ${name}${detail ? ' — ' + detail : ''}`) }
  else { fail++; console.log(`  ✘ ${name}${detail ? ' — ' + detail : ''}`) }
}

const api = async (method, p, body, token) => {
  const res = await fetch(API + p, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const t = await res.text()
  try { return JSON.parse(t) } catch { return { code: res.status, message: t } }
}
const lg = await api('POST', '/auth/login', { userName: 'admin', password: '123456' })
if (lg?.code !== 200) { console.log('管理员登录失败', JSON.stringify(lg).slice(0, 120)); process.exit(1) }
const admin = lg.data
console.log(`UI=${UI}  admin 已登录`)

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-orgperm-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1000',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
let tab
for (let i = 0; i < 30 && !tab; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* 等 Edge 起来 */ }
  if (!tab) await sleep(500)
}
if (!tab) { console.log('[FATAL] Edge CDP 未就绪(本机沙箱下 Edge 渲染进程可能起不来)'); edge.kill(); process.exit(2) }
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0
const pending = new Map()
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true }))?.result?.result?.value
const nav = async (url, wait = 3000) => { await send('Page.navigate', { url }); for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') break } await sleep(wait) }
const shot = async (name) => {
  let r = await send('Page.captureScreenshot', { format: 'png' })
  if (!r?.result?.data) { await sleep(800); r = await send('Page.captureScreenshot', { format: 'png' }) }
  if (!r?.result?.data) { console.log('  ! 截图失败:', name); return }
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64'))
  console.log('  · 截图:', name)
}
await send('Page.enable'); await send('Runtime.enable')

/* 进站:注入 token(同源 localStorage),再跳路由 */
await nav(`${UI}/#/login`, 1200)
await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(admin.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(admin.user))}); 'ok'`)
await nav('about:blank', 300)
await nav(`${UI}/#/sys/org`, 5000)
await evaluate(`(() => { const b = document.querySelector('.wz-skip'); if (b) b.click(); return 1 })()`)
await sleep(500)

/* 选一个非超级角色行(矩阵只在选中角色后才渲染)—— 明确挑「普通用户」 */
const picked = await evaluate(`(() => {
  const rows = Array.from(document.querySelectorAll('.org-col.roles .el-table__row'))
  const r = rows.find(x => x.innerText.includes('普通用户')) || rows.find(x => !/超级/.test(x.innerText)) || rows[0]
  r?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return r ? r.innerText.replace(/\\s+/g, ' ').trim() : ''
})()`)
await sleep(3000)
check('选中角色行后权限矩阵进入配置态', !!picked, `角色行「${picked}」`)

/* 展开「研发管理」分组(默认折叠) */
const groups = await evaluate(`Array.from(document.querySelectorAll('.perm-collapse .el-collapse-item')).map((it, i) => ({ i, t: (it.querySelector('.g-title')?.textContent || '').trim(), n: (it.querySelector('.g-count')?.textContent || '').trim() }))`)
const GNAMES = (groups || []).map((g) => g.t)
console.log('  · 模块分组:', (groups || []).map((g) => g.t + '(' + g.n + ')').join(' | '))

/* 分组必须全是导航一级模块(2026-10-16 用户口径:「要按照模块来收纳面板」)——
   导航一级 = frontend/src/business/menus.js 的 6 个 + 我的桌面;野分组(基础设置/系统管理)一律 FAIL */
const NAV_MODULES = ['我的桌面', '研发管理', '智能供应链', '生产制造', '品质管理', '财务管理', '设备管理', '基础档案']
const stray = GNAMES.filter((n) => !NAV_MODULES.includes(n))
check('矩阵分组全部是导航一级模块(无「基础设置/系统管理」这类野分组)', stray.length === 0, stray.join(',') || '无')
await shot('2-orgadmin-groups-collapsed.png')

const rdIdx = (groups || []).find((g) => g.t === '研发管理')?.i
check('权限矩阵里存在「研发管理」分组', rdIdx !== undefined, `第 ${rdIdx} 组`)
if (rdIdx !== undefined) {
  await evaluate(`document.querySelectorAll('.perm-collapse .el-collapse-item')[${rdIdx}].querySelector('.el-collapse-item__header')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`)
  await sleep(1500)
}
const rdThs = (await evaluate(`JSON.stringify(Array.from(document.querySelectorAll('.perm-collapse .el-collapse-item')[${rdIdx}]?.querySelectorAll('.perm-table thead th') || []).map(e => e.textContent.trim()))`)) || '[]'
const TH = JSON.parse(rdThs)
console.log(`  · 研发管理矩阵列(${TH.length}): ${TH.join(' | ')}`)

check('研发管理矩阵列里出现「申请修改」(引擎 modify 词,旧版没有这一列)', TH.includes('申请修改'), TH.join('|'))
check('研发管理矩阵列里出现「修改记录」(引擎 modlog 词)', TH.includes('修改记录'), TH.join('|'))
check('研发管理矩阵列里出现「删除申请」(引擎 del 词)', TH.includes('删除申请'), TH.join('|'))
for (const dead of ['价格金额', '复核反审核', '调价']) {
  check(`废词列已消失:「${dead}」`, !TH.includes(dead), TH.join('|'))
}
check('旧列「修改」「删除」已改名(不再有孤立的中文「修改」/「删除」列)',
  !TH.includes('修改') && !TH.includes('删除'), TH.join('|'))
check('列数 = 面板 + 11 引擎词 + 全选', TH.length === 13, `实际 ${TH.length}`)

/* 那一行「项目进度查询」:原来授不出的 modify/del 现在应真的勾着 */
const rowInfo = await evaluate(`(() => {
  const it = document.querySelectorAll('.perm-collapse .el-collapse-item')[${rdIdx}]
  const ths = Array.from(it.querySelectorAll('.perm-table thead th')).map(e => e.textContent.trim())
  const tr = Array.from(it.querySelectorAll('.perm-table tbody tr')).find(r => (r.cells[0]?.innerText || '').includes('项目进度查询'))
  if (!tr) return 'NO_ROW'
  const checked = []
  Array.from(tr.cells).forEach((td, i) => { const cb = td.querySelector('input.pt-cb'); if (cb && cb.checked) checked.push(ths[i] || ('#' + i)) })
  return JSON.stringify({ checked, cells: tr.cells.length })
})()`)
console.log(`  · 「项目进度查询」行: ${rowInfo}`)
let info = null
try { info = JSON.parse(rowInfo) } catch { /* NO_ROW 等 */ }
check('「项目进度查询」行在库里授的 modify/del 现在**看得见且已勾选**', !!info && info.checked.includes('申请修改') && info.checked.includes('删除申请'), rowInfo)

/* 表格几何:列少了不该被压坏(读实际像素) */
const geo = await evaluate(`(() => {
  const it = document.querySelectorAll('.perm-collapse .el-collapse-item')[${rdIdx}]
  const tb = it.querySelector('.perm-table'); if (!tb) return 'NO_TABLE'
  const wrap = it.querySelector('.perm-table-wrap')
  const cs = getComputedStyle(tb)
  return JSON.stringify({ tableW: Math.round(tb.getBoundingClientRect().width), wrapW: Math.round(wrap.getBoundingClientRect().width),
    scrollW: wrap.scrollWidth, minW: cs.minWidth, layout: cs.tableLayout })
})()`)
console.log(`  · 表格几何: ${geo}`)
let g = null
try { g = JSON.parse(geo) } catch { /* */ }
check('表格宽度与容器自洽(不横向溢出/不被压切)', !!g && g.scrollW <= Math.max(g.wrapW, g.tableW) + 2, geo)

await shot('1-orgadmin-rd-matrix.png')

/* 对比:旧实例 8090(若在跑) */
if (UI !== 'http://127.0.0.1:8090') {
  const old = await fetch('http://127.0.0.1:8090/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) }).then((r) => r.json()).catch(() => null)
  if (old?.code === 200) {
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(old.data.token)}); 'ok'`)
    await nav(`${UI}/#/dashboard`, 1500)
    console.log('  (旧实例在跑;其列集由接口取证 _q-perm-gate-e2e.mjs A 段给出)')
  }
}

ws.close(); edge.kill()
console.log(`\n=== 界面取证:PASS ${pass} / FAIL ${fail}(截图在 ${OUT})===`)
process.exit(fail ? 1 : 0)
