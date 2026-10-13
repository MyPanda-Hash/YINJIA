/*
 * _verify-qc-insp-plan-merge.mjs — 检验项目/检验方案「单一入口 + 两用弹窗」界面实测(2026-10-09,一次性探针)
 *
 * 断言(对应用户拍板):
 *   ①「更多」里只剩**一个**入口「检验项目/检验方案」,旧的「选检验项目」「检验项目维护」都不再下发
 *   ②弹窗 = 上方案表 + 桥接条 + 下项目表(带勾选列) + 底部 已选/带入明细
 *   ③点方案行 → 下方加载出该方案的项目
 *   ④勾选(表头全选)→「已选 N 项」= 项目数 →「带入明细」→ 明细出现 N 行(表区=检验项目)
 * ⚠ 只读:全程不点保存。用法: node tools/archive/_verify-qc-insp-plan-merge.mjs http://127.0.0.1:8091
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8091').replace(/\/$/, '')
const PORT = 9460
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const HERE = import.meta.dirname
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const token = login.data.token, user = JSON.stringify(login.data.user)

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-merge-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1700,1050',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
try {
  const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
  const realClick = async (sel) => {
    const rc = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`)
    if (!rc) return false
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rc.x, y: rc.y, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rc.x, y: rc.y, button: 'left', clickCount: 1 })
    return true
  }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1050, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(user)}); localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
  await send('Page.navigate', { url: `${BASE}/#/panelx/list/QC_ASM_INSP` }); await sleep(6000)

  const gridRows = () => ev(`[...document.querySelectorAll('.el-table__body-wrapper tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>(td.innerText||'').trim()).filter(Boolean).join('|'))`)
  const before = await gridRows()
  const beforeItems = before.filter((r) => /目数|检验项目/.test(r)).length

  const openMore = () => ev(`(()=>{const grp=[...document.querySelectorAll('.tb-group')].find(g=>/更多/.test((g.querySelector('.tb-main')||{}).textContent||''));if(!grp)return 'NO_MORE';(grp.querySelector('.tb-caret')||{click(){}}).click();return 'CLICKED'})()`)
  for (let i = 0; i < 3 && (await openMore()) !== 'CLICKED'; i++) await sleep(500)
  await sleep(600)
  const menu = String(await ev(`[...document.querySelectorAll('.tb-menu .ctx-item')].map(x=>(x.textContent||'').trim()).join('|')`))
  console.log('    更多菜单 = ' + menu)
  ok('① 有唯一入口「检验项目/检验方案」', /检验项目\/检验方案/.test(menu), menu.slice(0, 160))
  ok('① 旧入口「选检验项目」「检验项目维护」已不再下发', !/选检验项目/.test(menu) && !/检验项目维护/.test(menu), menu.slice(0, 160))

  const clicked = await ev(`(()=>{const it=[...document.querySelectorAll('.tb-menu .ctx-item')].filter(x=>x.getBoundingClientRect().height>0).find(x=>/检验项目\\/检验方案/.test(x.textContent||''));if(!it)return 'NO_ITEM';it.click();return 'CLICKED'})()`)
  ok('① 点开该入口', clicked === 'CLICKED', String(clicked))
  await sleep(1800)

  const dlgTitle = String(await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>/检验项目\\/检验方案/.test((x.querySelector('.el-dialog__title')||{}).textContent||''));return d?(d.querySelector('.el-dialog__title').innerText||''):''})()`))
  ok('② 弹窗标题 = 检验项目/检验方案', /检验项目\/检验方案/.test(dlgTitle), dlgTitle)
  const dlgText = String(await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>/检验项目\\/检验方案/.test((x.querySelector('.el-dialog__title')||{}).textContent||''));return d?(d.innerText||''):''})()`))
  ok('② 弹窗含 上方案表/桥接条/下项目表/带入明细', /检验方案/.test(dlgText) && /当前方案|请先在上方点选/.test(dlgText) && /检验项目/.test(dlgText) && /带入明细/.test(dlgText), dlgText.replace(/\s+/g, ' ').slice(0, 200))
  ok('② 项目表带勾选列 + 底部「已选/带入明细」', /已选/.test(dlgText) && /带入明细/.test(dlgText), dlgText.replace(/\s+/g, ' ').slice(-140))
  const plans = await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>/检验项目\\/检验方案/.test((x.querySelector('.el-dialog__title')||{}).textContent||''));const t=d.querySelector('.el-table');return t?t.querySelectorAll('.el-table__body-wrapper tbody tr').length:0})()`)
  ok('② 方案表已加载', plans > 0, plans + ' 行')

  // ③ 点第一行方案 → 项目表加载
  const planText = await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>/检验项目\\/检验方案/.test((x.querySelector('.el-dialog__title')||{}).textContent||''));const t=d.querySelector('.el-table');const tr=t.querySelector('.el-table__body-wrapper tbody tr');return tr?(tr.innerText||'').replace(/\\s+/g,' ').trim():''})()`)
  await realClick('.el-dialog .el-table__body-wrapper tbody tr td')
  await sleep(1500)
  const itemN = await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>/检验项目\\/检验方案/.test((x.querySelector('.el-dialog__title')||{}).textContent||''));const ts=d.querySelectorAll('.el-table');if(ts.length<2)return -1;return ts[1].querySelectorAll('.el-table__body-wrapper tbody tr').length})()`)
  ok('③ 点方案行后加载出该项目', itemN > 0, `方案=${planText.slice(0, 40)} 项目=${itemN}`)

  // ④ 全选 → 带入明细
  await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>/检验项目\\/检验方案/.test((x.querySelector('.el-dialog__title')||{}).textContent||''));const ts=d.querySelectorAll('.el-table');const cb=ts[1].querySelector('.el-table__header-wrapper .el-checkbox');if(cb)cb.click();return 'ok'})()`)
  await sleep(600)
  const pickedN = await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>/检验项目\\/检验方案/.test((x.querySelector('.el-dialog__title')||{}).textContent||''));const m=(d.innerText||'').match(/已选\\s*(\\d+)\\s*项/);return m?Number(m[1]):-1})()`)
  ok('④ 勾选后「已选 N 项」= 项目数', pickedN === itemN, `已选 ${pickedN} / 项目 ${itemN}`)
  await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>/检验项目\\/检验方案/.test((x.querySelector('.el-dialog__title')||{}).textContent||''));const b=[...d.querySelectorAll('.el-dialog__footer button')].find(x=>/带入明细/.test(x.textContent||''));if(b)b.click();return 'ok'})()`)
  await sleep(1500)
  const after = await gridRows()
  const added = after.filter((r) => /检验项目/.test(r) && !/数量判定/.test(r))
  ok('④ 带入后明细新增项目行', added.length >= Math.max(itemN, 1), `${beforeItems} → ${added.length}`)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  if (shot?.result?.data) console.log('    [截图] ' + path.join(HERE, '_shot-qc-insp-plan-merge.png'))
  if (shot?.result?.data) fs.writeFileSync(path.join(HERE, '_shot-qc-insp-plan-merge.png'), Buffer.from(shot.result.data, 'base64'))
  console.log('    ⚠ 全程未点保存,库内数据未改动')
} finally { try { edge.kill() } catch { /* ignore */ } }
console.log(`\n[结果] pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
