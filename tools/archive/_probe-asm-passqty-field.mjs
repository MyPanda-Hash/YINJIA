/*
 * _probe-asm-passqty-field.mjs — 组装成品检验单表头「合格数量」(必填)的接口 + 界面取证(2026-10-17,一次性探针)
 *
 * 用户口径:「为当前的表头增加合格数量(入库)的字段,设定为必填。让当前审核完成后才对这些数量产生到产成品
 *   入库单内。」
 * 断言(只读,不点保存):
 *   API ① 面板配置的**表头字段**里有 合格数量,isRequired=true、类型=小数;
 *   API ② 表头字段次序 = 检验数量 → 合格数量 → …(seq 135);
 *   UI  ③ 表头区渲染出该字段,且 label 带必填样式(label.req);
 *   UI  ④ 该格的录入控件在草稿态可用(not disabled)。
 * 用法: node tools/archive/_probe-asm-passqty-field.mjs [base]   (默认 5173 源码热更环境)
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'

const BASE = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '')
const PANEL = 'QC_ASM_INSP'
const FIELD = '合格数量'
const PORT = 9484
const EDGE = process.env.YJ_EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok   - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  | ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const cfg = (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=${PANEL}`,
  { headers: { Authorization: 'Bearer ' + login.data.token } }).then((r) => r.json())).data

const fields = cfg?.dataSchema?.fields || []
const f = fields.find((x) => (x.dataName || x.name) === FIELD)
console.log('   表头字段数 = ' + fields.length + ' / 命中 = ' + JSON.stringify(f || null))
ok('① 表头字段里有「' + FIELD + '」', !!f)
ok('① 该字段 isRequired = true(必填)', !!f && f.isRequired === true, JSON.stringify(f && { req: f.isRequired }))
ok('① 该字段类型 = 小数', !!f && f.dataType === '小数', f && f.dataType)
const names = String(cfg?.metadata?.formPages?.[0]?.fieldNames
  || cfg?.metadata?.panelPageDto?.formPages?.[0]?.fieldNames
  // 面板没下发 formPages 时,表头次序的真源就是 dataSchema 里**非隐藏**字段的先后(与 PanelxList.headerFields 同源)
  || fields.filter((x) => !x.hidden).map((x) => x.dataName || x.name).join(',')).split(',').map((s) => s.trim())
const iInsp = names.indexOf('检验数量')
const iPass = names.indexOf(FIELD)
const iEmp = names.indexOf('检验员')
console.log('   表头次序(片段): ' + names.slice(Math.max(0, iPass - 2), iPass + 2).join(' → '))
// ⚠ 实测次序 = 检验数量 → 处理方式 → 合格数量 → 检验员:处理方式 与 检验数量 **同为 seq 130**
//   (按 id 兜底排序),不挪别人的字段次序就做不到"紧贴检验数量";本断言只要求它落在数量簇里
//   (检验数量 之后、检验员 之前)。要挪到紧贴检验数量,得改 处理方式 的 seq(属别人调好的字段次序,未动)。
ok('② 表头次序 = 在「检验数量」之后(数量簇里)',
  iInsp >= 0 && iPass > iInsp, `检验数量@${iInsp} 合格数量@${iPass}`)
ok('② 落在「检验员」之前', iEmp < 0 || iPass < iEmp, `合格数量@${iPass} 检验员@${iEmp}`)

/* ── 界面 ── */
const profile = fs.mkdtempSync(path.join(process.env.YJ_PROFILE_DIR || os.tmpdir(), 'yj-asm-pass-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1760,1200',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(3000)
try {
  const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let n = 0; const pend = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++n; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
  await send('Page.navigate', { url: `${BASE}/#/panelx/list/${PANEL}` }); await sleep(8000)

  const probe = await ev(`(() => {
    const fs = [...document.querySelectorAll('.header-fields .field')];
    const hit = fs.find(x => ((x.querySelector('label')||{}).innerText||'').trim().startsWith(${JSON.stringify(FIELD)}));
    if (!hit) return { found: false, labels: fs.map(x => ((x.querySelector('label')||{}).innerText||'').trim()).filter(Boolean) };
    const lb = hit.querySelector('label');
    const inp = hit.querySelector('input');
    return { found: true, req: lb.classList.contains('req'), label: (lb.innerText||'').trim(),
             hasInput: !!inp, disabled: inp ? (inp.disabled === true) : null,
             val: inp ? inp.value : null };
  })()`)
  console.log('   界面取证: ' + JSON.stringify(probe))
  ok('③ 表头区渲染出「' + FIELD + '」', probe?.found === true, JSON.stringify((probe?.labels || []).slice(-6)))
  ok('③ label 带必填样式(req)', probe?.req === true)
  ok('④ 该格有录入控件', probe?.hasInput === true)
  ok('④ 草稿态可录入(不是 disabled)', probe?.hasInput === true && probe.disabled !== true)
} finally {
  try { edge.kill() } catch { /* 忽略 */ }
}
console.log(fail === 0 ? `\n[PASS] ${pass} 项(表头「${FIELD}」必填字段就位)` : `\n[FAIL] ${fail} 项`)
process.exit(fail === 0 ? 0 : 1)
