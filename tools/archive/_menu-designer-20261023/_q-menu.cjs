/**
 * _q-menu.cjs —— 系统管理平台 · 菜单设计 活体取证(2026-10-23)
 *
 * 断言链(全程可回滚,结尾一定 restore):
 *   ① GET /api/sys/menu/nodes 初始为空(未定制)
 *   ② 页面 /#/sys/menuDesign 能打开:树节点 > 50、未改动时「保存」禁用、右栏提示无改动
 *   ③ 校验闸门:上级不存在的行 → 400;未登录写 → 403
 *   ④ 保存一条**真实改造**:一级「系统管理平台」改名 + 保养计划(MAINT_PLAN)挪进「系统功能」
 *      + 隐藏「状态统计」→ GET 回读 count = 全部节点数
 *   ⑤ 刷新页面后左栏真的变了:新名在、状态统计不在、保养计划挂在系统功能下
 *   ⑥ POST /reset → count 回 0,刷新后左栏恢复「系统管理平台」/「状态统计」
 *
 * 用法:node _q-menu.cjs [base] [YJ|YJ_TEST]
 */
'use strict'
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const FACTORY = process.argv[3] || 'YJ'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9421
const OUT = path.join(__dirname, 'shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fail = 0
const ok = (m) => console.log('  [PASS] ' + m)
const bad = (m) => { fail++; console.log('  [FAIL] ' + m) }
const NEW_TOP = '系统管理(改名验证)'

async function login(userName, password) {
  const r = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, password, factory: FACTORY }),
  })).json()
  return r
}

async function api(method, url, token, body) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  let json = null
  try { json = await res.json() } catch { /* 非 JSON */ }
  return { status: res.status, json }
}

async function main() {
  const lr = await login('admin', '123456')
  const token = lr?.data?.token
  if (!token) throw new Error('admin 登录失败:' + JSON.stringify(lr).slice(0, 200))

  // 基线树与合并口径:直接 import 前端源码(与页面同一份真源)
  const menus = await import('file:///C:/INCER/YINJIA-MES/frontend/src/business/menus.js')
  const ov = await import('file:///C:/INCER/YINJIA-MES/frontend/src/business/menuOverrides.js')
  const baseRows = ov.flattenMenuNodes(menus.menuTree)
  console.log(`[base] 基线节点 ${baseRows.length} 个`)

  // ① 初始为空
  let g = await api('GET', '/api/sys/menu/nodes', token)
  if (g.json?.data?.count === 0) ok('① 初始覆盖为空(按代码基线)')
  else bad('① 初始覆盖应为空,实际 ' + JSON.stringify(g.json?.data?.count))
  const rows0 = g.json?.data?.nodes || []

  // ③ 校验闸门(先测,避免脏数据)
  const badRows = [{ menuCode: 'x1', parentCode: 'no-such-parent', title: '坏行', seq: 0, hidden: false, isNew: false }]
  const bad1 = await api('POST', '/api/sys/menu/nodes', token, badRows)
  if (bad1.status === 400) ok('③ 上级不存在 → 400:' + (bad1.json?.message || '').slice(0, 40))
  else bad('③ 上级不存在应 400,实际 ' + bad1.status)
  const bad2 = await api('POST', '/api/sys/menu/nodes', null, baseRows)
  if (bad2.status === 403) ok('③ 未登录写入 → 403')
  else bad('③ 未登录写入应 403,实际 ' + bad2.status)

  // ④ 构造一条真实改造
  const rows = (rows0.length ? rows0 : baseRows).map((r) => ({ ...r }))
  const byCode = new Map(rows.map((r) => [r.menuCode, r]))
  if (!byCode.get('base') || !byCode.get('sysFunc') || !byCode.get('maintPlan') || !byCode.get('dcStats')) {
    throw new Error('基线里找不到 base/sysFunc/maintPlan/dcStats,菜单结构可能已变')
  }
  byCode.get('base').title = NEW_TOP
  // 保养计划:从「设备维护」挪进「系统功能」(排到 sysFunc 末尾)
  byCode.get('maintPlan').parentCode = 'sysFunc'
  const sysKids = rows.filter((r) => r.parentCode === 'sysFunc').map((r) => r.menuCode)
  byCode.get('maintPlan').seq = 500 + sysKids.length
  // 隐藏整个「数采平台」一级模块(整枝隐藏:叶子也跟着不渲染)
  byCode.get('dc').hidden = true

  const save = await api('POST', '/api/sys/menu/nodes', token, rows)
  if (save.json?.code === 200 && save.json?.data?.count === rows.length) ok(`④ 保存成功(${rows.length} 项)`)
  else bad('④ 保存失败:' + JSON.stringify(save.json).slice(0, 300))

  const g2 = await api('GET', '/api/sys/menu/nodes', token)
  const rows2 = g2.json?.data?.nodes || []
  const rBase = rows2.find((r) => r.menuCode === 'base')
  const rMaint = rows2.find((r) => r.menuCode === 'maintPlan')
  const rStats = rows2.find((r) => r.menuCode === 'dc')
  if (rBase && rBase.title === NEW_TOP) ok('④ 回读:一级改名已落库')
  else bad('④ 回读改名失败:' + JSON.stringify(rBase))
  if (rMaint && rMaint.parentCode === 'sysFunc') ok('④ 回读:保养计划已挪进「系统功能」')
  else bad('④ 回读挪动失败:' + JSON.stringify(rMaint))
  if (rStats && rStats.hidden === true) ok('④ 回读:隐藏标记已落库')
  else bad('④ 回读隐藏失败:' + JSON.stringify(rStats))

  // ⑤ 页面侧真的变了
  fs.mkdirSync(OUT, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-menu-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(3000)
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pending = new Map()
  ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
  const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 120; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
  const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true }); fs.writeFileSync(path.join(OUT, n), Buffer.from(r.result.data, 'base64')); console.log('[shot]', n) }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await nav(`${BASE}/#/login`)
  await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
  await nav('about:blank')
  await nav(`${BASE}/#/dashboard`)
  await sleep(1500)
  const navText = await ev('(document.querySelector(".leftnav")||{}).innerText||""')
  if (navText.includes(NEW_TOP)) ok('⑤ 左栏显示改名后的一级模块')
  else bad('⑤ 左栏没有新名称,实际前 200 字:' + navText.slice(0, 200))
  if (!navText.includes('数采平台')) ok('⑤ 整枝隐藏的「数采平台」不在左栏')
  else bad('⑤ 「数采平台」应已隐藏')
  // 叶子挪动看设计器树里的真实层级(左栏只渲染一级/二级,叶子在浮层卡片里,innerText 取不到)
  await nav('about:blank')
  await nav(`${BASE}/#/sys/menuDesign`)
  await sleep(2500)
  // 展开全部,叶子节点(row)才会渲染进 DOM
  await ev(`(function(){var bs=[].slice.call(document.querySelectorAll('.md-actions button'));
    for(var i=0;i<bs.length;i++){ if((bs[i].textContent||'').trim()==='展开全部'){ bs[i].click(); return 'OK' } } return 'NO_BTN' })()`)
  await sleep(800)
  const chain = await ev(`(function(){
    var labs=[].slice.call(document.querySelectorAll('.md-tree .md-label'));
    var hit=null;
    for(var i=0;i<labs.length;i++){ if((labs[i].textContent||'').trim()==='保养计划'){ hit=labs[i]; break } }
    if(!hit) return ['NO_LEAF'];
    var out=[(hit.textContent||'').trim()];
    var leaf=hit.closest('.el-tree-node');
    var cur=leaf && leaf.parentElement ? leaf.parentElement.closest('.el-tree-node') : null;
    while(cur){
      var lb=cur.querySelector('.el-tree-node__content .md-label');
      if(lb) out.push((lb.textContent||'').trim());
      cur=cur.parentElement ? cur.parentElement.closest('.el-tree-node') : null;
    }
    return out.reverse();
  })()`)
  const chainText = (chain || []).join(' / ')
  if (chainText.includes('系统功能') && chainText.includes('保养计划')) ok('⑤ 设计器层级:系统功能 / 保养计划(已从设备维护挪过来)')
  else bad('⑤ 设计器层级不对:' + chainText + '(实际 ' + JSON.stringify(chain) + ')')
  const dcLabel = await ev(`(function(){
    var labs=[].slice.call(document.querySelectorAll('.md-tree .md-label'));
    for(var i=0;i<labs.length;i++){ if((labs[i].textContent||'').trim()==='数采平台'){
      var row=labs[i].closest('.md-node'); return row? row.className : 'NO_ROW' } }
    return 'NO_LABEL' })()`)
  if (String(dcLabel).includes('is-hidden')) ok('⑤ 隐藏项在设计器里仍可见(带 is-hidden 样式)')
  else bad('⑤ 隐藏项样式缺失:' + dcLabel)
  const nodes = await ev('document.querySelectorAll(".md-tree .el-tree-node").length')
  if (nodes > 50) ok(`⑤ 菜单设计页渲染 ${nodes} 个节点`)
  else bad('⑤ 菜单设计页节点过少:' + nodes)
  const saveDisabled = await ev(`(function(){var bs=[].slice.call(document.querySelectorAll('.md-actions button'));for(var i=0;i<bs.length;i++){if((bs[i].textContent||'').trim()==='保存'){return bs[i].disabled}}return 'NO_BTN'})()`)
  if (saveDisabled === true) ok('⑤ 未改动时「保存」禁用')
  else bad('⑤ 未改动时「保存」应禁用,实际 ' + saveDisabled)
  const hasHiddenTag = await ev(`(document.body.innerText||'').includes('已隐藏')`)
  if (hasHiddenTag) ok('⑤ 设计器里能看到被隐藏的节点(带「已隐藏」标记)')
  else bad('⑤ 设计器应显示「已隐藏」标记')
  await shot('menudesigner-1440.png')

  // 375 窄屏:无横向滚动
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true })
  await sleep(1200)
  const overflow375 = await ev('document.documentElement.scrollWidth - document.documentElement.clientWidth')
  if (overflow375 <= 1) ok('⑤ 375 宽无横向滚动')
  else bad('⑤ 375 宽出现横向滚动:' + overflow375 + 'px')
  await shot('menudesigner-375.png')

  // ⑥ 恢复
  const rs = await api('POST', '/api/sys/menu/reset', token, {})
  if (rs.json?.code === 200 && rs.json?.data?.cleared === rows.length) ok(`⑥ 恢复代码默认(清除 ${rs.json.data.cleared} 项)`)
  else bad('⑥ 恢复失败:' + JSON.stringify(rs.json).slice(0, 300))
  const g3 = await api('GET', '/api/sys/menu/nodes', token)
  if (g3.json?.data?.count === 0) ok('⑥ 回读覆盖已清空')
  else bad('⑥ 回读应为 0,实际 ' + g3.json?.data?.count)
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await nav('about:blank')   // 只改 hash 不会重载页面,必须走空白页再回来(store 只拉一次)
  await nav(`${BASE}/#/dashboard`)
  await sleep(1800)
  const navText2 = await ev('(document.querySelector(".leftnav")||{}).innerText||""')
  if (navText2.includes('系统管理平台') && navText2.includes('数采平台')) ok('⑥ 刷新后左栏恢复代码默认')
  else bad('⑥ 左栏未恢复,前 200 字:' + navText2.slice(0, 200))

  try { await send('Browser.close') } catch { /* ignore */ }
  try { edge.kill() } catch { /* ignore */ }
  console.log(fail ? `\n== FAIL ${fail} 项 ==` : '\n== ALL PASS ==')
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('[FATAL]', e); process.exit(2) })
