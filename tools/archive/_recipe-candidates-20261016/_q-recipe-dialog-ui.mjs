/**
 * _q-recipe-dialog-ui.mjs — 「配方计算」弹窗候选的**浏览器级**验收(2026-10-16)
 * 前提:本机已把 INV 的 detail_key 复刻成服务器形态(inv)。
 * 流程:登录 → 打开成型工艺清单 → 点「配方计算」→ 物料种类选「炭粉」→ 看「物料编号」下拉有多少候选。
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const UI = 'http://127.0.0.1:8090'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let bad = 0
const ok = (c, m, x = '') => { console.log((c ? '  [PASS] ' : '  [FAIL] ') + m + (x ? '  ' + x : '')); if (!c) bad++ }

const lg = await (await fetch(UI + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
if (!lg?.data?.token) { console.error('登录失败'); process.exit(1) }
const profile = mkdtempSync(join(tmpdir(), 'edge-rcd-'))
const edge = spawn(EDGE, ['--headless=new', '--remote-debugging-port=9345', `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', '--window-size=1500,1000', 'about:blank'], { stdio: 'ignore' })
let ws, id = 0
const pend = new Map()
for (let i = 0; i < 40; i++) {
  try {
    const l = await (await fetch('http://127.0.0.1:9345/json/list')).json()
    const p = l.find((t) => t.type === 'page')
    if (p?.webSocketDebuggerUrl) { ws = new WebSocket(p.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej }); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }; break }
  } catch {}
  await sleep(500)
}
const send = (method, params) => { const i = ++id; return new Promise((r) => { pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })) }) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: UI + '/#/login' }); await sleep(3000)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});localStorage.setItem('mes_locale','zh-CN');'ok'`)
await send('Page.navigate', { url: UI + '/#/panelx/list/RD_MOLD_PROC' }); await sleep(1500)
await send('Page.reload', { ignoreCache: true }); await sleep(7000)
await ev(`location.hash='#/panelx/list/RD_MOLD_PROC';'ok'`); await sleep(3000)

// 「配方计算」在**单据纸面**的工具栏里 ⇒ 先双击列表第一行打开单据,再找按钮
const opened = await ev(`(async()=>{
  const row=document.querySelector('.el-table__row')||document.querySelector('tbody tr');
  if(!row) return 'no-row';
  row.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
  return 'ok';
})()`)
ok(opened === 'ok', '列表里双击打开一张成型工艺清单', String(opened))
await sleep(6000)
const btnTexts = await ev(`[...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(Boolean).slice(0,24)`)
console.log('  纸面工具栏按钮:', JSON.stringify(btnTexts))
const clicked = await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim().includes('配方计算')); if(!b) return 'no'; b.click(); return 'ok';})()`)
ok(clicked === 'ok', '纸面「配方计算」按钮可点')
await sleep(2500)
const dlg = await ev(`!!document.querySelector('.el-dialog__body .el-select')`)
ok(dlg, '弹窗里出现「物料种类 / 物料编号」下拉')

// 选物料种类 = 炭粉(el-select 第一格)
const pickKind = await ev(`(async()=>{
  const sels=[...document.querySelectorAll('.el-dialog__body .el-select')];
  if(!sels.length) return 'no-select';
  sels[0].querySelector('input').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
  sels[0].querySelector('input').click();
  await new Promise(r=>setTimeout(r,900));
  const opt=[...document.querySelectorAll('.el-select-dropdown__item')].find(x=>x.innerText.trim()==='炭粉');
  if(!opt) return 'no-option:'+[...document.querySelectorAll('.el-select-dropdown__item')].slice(0,6).map(x=>x.innerText.trim()).join(',');
  opt.click(); return 'ok';
})()`)
ok(pickKind === 'ok', '物料种类选到「炭粉」', String(pickKind))
await sleep(3500)

// 打开物料编号下拉,数候选
const cand = await ev(`(async()=>{
  const sels=[...document.querySelectorAll('.el-dialog__body .el-select')];
  const target=sels[1]||sels[0];
  target.querySelector('input').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
  target.querySelector('input').click();
  await new Promise(r=>setTimeout(r,1200));
  const items=[...document.querySelectorAll('.el-select-dropdown__item')].map(x=>x.innerText.trim()).filter(Boolean);
  const empty=document.querySelector('.rcd-sel-empty');
  return JSON.stringify({n:items.length, sample:items.slice(0,3), empty: empty? empty.innerText.trim().slice(0,24):null});
})()`)
console.log('  物料编号下拉:', cand)
let parsed = {}
try { parsed = JSON.parse(cand) } catch {}
ok(Number(parsed.n) > 0, '物料编号下拉**有候选**(修复生效)', `候选 ${parsed.n} 个, 例 ${JSON.stringify(parsed.sample)}`)
ok(!parsed.empty, '不再显示「没有候选」空槽', String(parsed.empty || ''))
try { edge.kill() } catch {}
console.log(bad ? `[FAIL] ${bad} 项` : '[OK] 配方计算候选:浏览器级验收通过')
process.exit(bad ? 1 : 0)
