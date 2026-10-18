/**
 * 一次性探针(2026-10-18):调拨单/盘点单 **与出入库单对齐** 的界面取证 + 截图。
 *
 * 验四件事(逐条打 [PASS]/[FAIL]):
 *   ① 列表页左「XX单选择」轨在,列头 = 单号 | 日期 | …中间列… | 审核状态(对齐采购入库单);
 *   ② 选中一张单后,单据页有「附件」区且 6 个列位;
 *   ③ 点「选单」弹出的库存选货列表**有数据**(来源面板 STOCK_PICK);
 *   ④ 勾选后「确定」能把行带进明细(物料/仓库/批号落对列)。
 *
 * 产物:tools/archive/_transfer-stocktake-probe/shots/*.png
 * 用法:node tools/archive/_transfer-stocktake-probe/_ui-align.mjs [uiBase]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const UI = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const API = 'http://127.0.0.1:8090'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const OUT = 'tools/archive/_transfer-stocktake-probe/shots'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })

let pass = 0, fail = 0
const check = (what, ok, extra) => {
  if (ok) { pass++; console.log('  [PASS] ' + what + (extra ? ' — ' + extra : '')) }
  else { fail++; console.log('  [FAIL] ' + what + (extra ? ' — ' + extra : '')) }
}

const lg = await (await fetch(API + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = lg.data.token

const profile = mkdtempSync(join(tmpdir(), 'edge-align-'))
const edge = spawn(EDGE, ['--headless=new', '--remote-debugging-port=9348', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1680,1000', 'about:blank'], { stdio: 'ignore' })

let ws, msgId = 0
const pending = new Map()
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch('http://127.0.0.1:9348/json/list')).json()
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) {
      ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
      ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
      break
    }
  } catch {}
  await sleep(500)
}
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: UI + '/#/login' })
await sleep(3500)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))}); 'ok'`)
await send('Page.navigate', { url: UI + '/#/dashboard' })
await sleep(1200)
await send('Page.reload', { ignoreCache: true })
await sleep(8000)

async function go(path, waitSel, tries = 40) {
  await ev(`location.hash = '${path}'; 'ok'`)
  await sleep(1500)
  for (let i = 0; i < tries; i++) {
    if (await ev(`!!document.querySelector(${JSON.stringify(waitSel)})`)) return true
    await sleep(500)
  }
  return false
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  if (r.result?.data) writeFileSync(join(OUT, name), Buffer.from(r.result.data, 'base64'))
}

for (const code of ['TRANSFER', 'STOCKTAKE']) {
  console.log('\n=== ' + code + ' ===')
  const hasRail = await go('/panelx/list/' + code, '.doc-select-rail')
  check(code + ' 列表页有「单据选择」轨', hasRail)
  if (!hasRail) continue

  const heads = await ev(`[...document.querySelectorAll('.doc-select-rail thead th')].map(th=>th.innerText.trim())`)
  const title = await ev(`document.querySelector('.doc-select-rail .dsr-title')?.innerText.trim()`)
  const rows = await ev(`document.querySelectorAll('.doc-select-rail tbody tr').length`)
  console.log('    轨标题=' + title + ' 列头=' + JSON.stringify(heads) + ' 行数=' + rows)
  check(code + ' 轨列头首=单号 / 末=审核状态',
    Array.isArray(heads) && heads[0] === '单号' && heads[heads.length - 1] === '审核状态')
  check(code + ' 轨里有单据(数据已保留)', Number(rows) > 0, '行数=' + rows)

  // 选中第一张单 → 附件区应在
  if (Number(rows) > 0) {
    await ev(`document.querySelector('.doc-select-rail tbody tr').dispatchEvent(new MouseEvent('click',{bubbles:true})); 'ok'`)
    await sleep(3000)
    const attach = await ev(`[...document.querySelectorAll('.attach-strip-label')].map(e=>e.innerText.trim())`)
    const slots = await ev(`document.querySelectorAll('.attach-slot').length`)
    console.log('    附件标签=' + JSON.stringify(attach) + ' 聚合格=' + slots)
    check(code + ' 单据页有「附件」区', Array.isArray(attach) && attach.length > 0)
    check(code + ' 附件聚合格 = 1(6 个列位合成一格,与采购入库单同款)', Number(slots) === 1, '实际 ' + slots)
    await shot(`${code}-list.png`)
  }

  // ③ 选单:先「新增」回到可编辑态(已审核单据上选单是灰的),再点「选单」
  await ev(`(() => {
    const bs = [...document.querySelectorAll('button, .el-button')];
    const b = bs.find(x => (x.innerText || '').trim().startsWith('新增'));
    if (b) b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return 'ok';
  })()`)
  await sleep(2500)
  const clicked = await ev(`(() => {
    // 工具栏动作是 <span class="act-name">选单</span>(外层 div 挂 click),不是 <button> ——
    // 在 span 上派发 bubbling click 即可触发外层处理器。
    const sp = [...document.querySelectorAll('.act-name')].find(x => (x.innerText || '').trim() === '选单');
    if (!sp) return 'no-button';
    const host = sp.closest('.act-btn, .tool-btn, .btn, [class*="act"]') || sp.parentElement;
    if (host && (host.classList.contains('is-disabled') || host.disabled)) return 'disabled';
    sp.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return 'clicked';
  })()`)
  check(code + ' 工具栏有「选单」按钮', clicked === 'clicked', clicked)
  if (clicked !== 'clicked') {
    const dump = await ev(`JSON.stringify({
      actNames: [...document.querySelectorAll('.act-name')].map(e => e.innerText.trim()),
      leaf: [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /选单/.test(e.innerText || '')).map(e => e.tagName + '.' + e.className).slice(0, 5),
      toolbarText: (document.querySelector('.pxtoolbar, .toolbar, .act-bar, .btn-bar')?.innerText || '').replace(/\\n/g, '|').slice(0, 200),
    })`)
    console.log('    DOM 诊断=' + dump)
  }
  if (clicked === 'clicked') {
    await sleep(3500)
    const dlgTitle = await ev(`document.querySelector('.el-dialog__title')?.innerText.trim()`)
    const dlgRows = await ev(`document.querySelectorAll('.el-dialog .el-table__body tbody tr').length`)
    console.log('    选单弹窗标题=' + dlgTitle + ' 行数=' + dlgRows)
    check(code + ' 「选单」弹出库存选货且有数据', Number(dlgRows) > 0, '行数=' + dlgRows)
    await shot(`${code}-pick.png`)
    // ④ 勾第一行 → 确定 → 明细应出现带入的行
    await ev(`(() => {
      const cb = document.querySelector('.el-dialog .el-table__body tbody tr .el-checkbox__original');
      if (cb) cb.click();
      return 'ok';
    })()`)
    await sleep(700)
    const okState = await ev(`(() => {
      const bs = [...document.querySelectorAll('.el-dialog__footer button, .el-dialog .el-button')];
      const b = bs.find(x => /确定/.test((x.innerText || '').trim()));
      if (!b) return 'no-ok';
      if (b.disabled) return 'ok-disabled';
      b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return 'clicked-ok';
    })()`)
    await sleep(2500)
    const detailText = await ev(`(document.querySelector('.detail-grid, .lines-grid, .el-table__body')?.innerText || '').slice(0, 300)`)
    check(code + ' 选单勾选后「确定」把行带进明细',
      okState === 'clicked-ok' && /HP-08|A-48|存货|PC0000/.test(String(detailText)), `ok=${okState}`)
    await shot(`${code}-filled.png`)
    // 收尾:关弹窗、不保存(避免污染演示数据)
    await ev(`(() => {
      const bs = [...document.querySelectorAll('.el-dialog__footer button, .el-dialog .el-button')];
      const b = bs.find(x => /取消/.test((x.innerText || '').trim()));
      if (b) b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return 'ok';
    })()`)
  }
}

console.log(`\n=== 汇总:PASS ${pass} / FAIL ${fail} ===`)
console.log('截图目录:' + OUT)
try { edge.kill() } catch {}
process.exit(fail === 0 ? 0 : 1)
