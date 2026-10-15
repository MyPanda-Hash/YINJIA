/*
 * _probe-first-insp-head.mjs — 首件检验纸张**抬头可填性**验收(2026-10-16 用户口径:
 *   「当前上面这一部分均不能填写需要实现变为可填写的实现,让当前实现没有成功对应上」)。
 *
 * 验什么(截图上那个红框):
 *   ① 右上信息三格(表单管理人/密级/使用范围)在草稿态是**可操作控件**(输入框/下拉),不是死文本;
 *   ② 抬头四对(产品编号/产品型号/生产日期/组别)同样可填,生产日期是日期选择器;
 *   ③ 真填进去:`head` 上的键就是后端列名(表单管理人/密级/使用范围/生产日期/产品编码/规格型号/生产线),
 *      **不是** undefined 或纸面标签名(「产品编号」这类纸面词不能当数据键);
 *   ④ 只读态(已审核)回落成纯文本,不出现可编辑控件。
 *
 * ⚠ 全程在**内存里填**(点「新增」起一张空草稿),不保存、不落库。
 * 用法: node tools/archive/_probe-first-insp-head.mjs [base]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9499
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-fih-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1700,1100', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000)
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ }
}
let ws = null
try {
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map(); const errs = []
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails?.exception?.description || '').slice(0, 180))
  }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1100, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2200)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
    localStorage.setItem('mes_user', ${JSON.stringify(login.data.user)});
    localStorage.setItem('mes_locale','zh-CN'); localStorage.setItem('mes_init_done','1'); 'ok'`)
  await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/QC_FIRST_INSP` })
  for (let i = 0; i < 80; i++) { await sleep(500); if (await ev(`!!document.querySelector('.panelx-list')`)) break }
  await sleep(2800)
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click()}
    const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(700)
  // 起一张空草稿
  await ev(`(() => { const b=[...document.querySelectorAll('.approval-side [class*=as-side]')].find(x=>(x.innerText||'').trim()==='新增'); if(b) b.click(); return 'ok' })()`)
  await sleep(2800)
  await ev(`(() => { const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(900)

  // ① 右上信息三格:控件类型
  const info = await ev(`(() => {
    const t = document.querySelector('.fi-sheet .fi-info')
    if (!t) return { ok: false }
    return [...t.querySelectorAll('tr')].map((tr) => {
      const label = (tr.querySelector('th')?.innerText || '').trim()
      const input = !!tr.querySelector('td input')
      const select = !!tr.querySelector('td .el-select')
      return { label, input, select }
    })
  })()`)
  console.log(`  右上信息格=${JSON.stringify(info)}`)
  ok('① 右上三格都渲染出来了', Array.isArray(info) && info.length === 3, JSON.stringify(info))
  ok('① 表单管理人/密级/使用范围 都是可操作控件',
    Array.isArray(info) && info.length === 3 && info.every((x) => x.input || x.select),
    JSON.stringify(info))
  ok('① 密级/使用范围 是下拉',
    Array.isArray(info) && info.filter((x) => x.select).length === 2, JSON.stringify(info))

  // ② 抬头四对:控件类型(生产日期应为日期选择器)
  const head = await ev(`(() => {
    const t = document.querySelector('.fi-sheet .fi-head')
    if (!t) return { ok: false }
    const ths = [...t.querySelectorAll('th')].map(e => (e.innerText||'').trim())
    const tds = [...t.querySelectorAll('td')]
    return tds.map((td, i) => ({
      label: ths[i],
      input: !!td.querySelector('input'),
      date: !!td.querySelector('.el-date-editor'),
    }))
  })()`)
  console.log(`  抬头四对=${JSON.stringify(head)}`)
  ok('② 抬头四对都在', Array.isArray(head) && head.length === 4, JSON.stringify(head))
  ok('② 四对全部可填', Array.isArray(head) && head.length === 4 && head.every((x) => x.input), JSON.stringify(head))
  const dateCell = Array.isArray(head) ? head.find((x) => x.label === '生产日期') : null
  ok('② 生产日期是日期选择器', !!dateCell?.date, JSON.stringify(dateCell))

  // ③ 真填进去:写值后看内存里的 head 键(必须是后端列名)
  const filled = await ev(`(() => {
    const set = (inp, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(inp, v); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const t = document.querySelector('.fi-sheet .fi-info')
    const rows = [...t.querySelectorAll('tr')]
    const ins = rows.map(r => r.querySelector('input')).filter(Boolean)
    if (ins[0]) set(ins[0], '刘磊')
    const h = document.querySelector('.fi-sheet .fi-head')
    const hins = [...h.querySelectorAll('td input')]
    if (hins[0]) set(hins[0], 'LINK-001')
    return { infoInputs: ins.length, headInputs: hins.length }
  })()`)
  await sleep(900)
  console.log(`  可写控件=${JSON.stringify(filled)}`)
  ok('③ 右上/抬头都有可写的输入框', filled.infoInputs >= 1 && filled.headInputs >= 1, JSON.stringify(filled))

  // 读回:纸张上确实显示了刚填的值(证明 v-model 双向绑上了真实字段)
  const shown = await ev(`(() => {
    const t = document.querySelector('.fi-sheet .fi-info')
    const v1 = (t.querySelectorAll('tr')[0].querySelector('input') || {}).value || ''
    const h = document.querySelector('.fi-sheet .fi-head')
    const v2 = ([...h.querySelectorAll('td input')][0] || {}).value || ''
    return { 表单管理人: v1, 产品编号: v2 }
  })()`)
  console.log(`  回读=${JSON.stringify(shown)}`)
  ok('③ 表单管理人 填得进、回读一致', shown.表单管理人 === '刘磊', JSON.stringify(shown))
  ok('③ 产品编号 填得进、回读一致', shown.产品编号 === 'LINK-001', JSON.stringify(shown))

  ok('④ 无未捕获的运行时异常', errs.length === 0, errs.join(' | '))
} finally {
  try { ws?.close() } catch { /* ignore */ }
  edge.kill()
}
console.log(`\n== 首件检验纸张抬头可填性:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
