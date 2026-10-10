/*
 * _verify-qc-insp-pick-ui.mjs — 「选检验项目 → 带入当前单据明细」界面实测(2026-10-09,一次性探针)
 *
 * 链路:登录 → 打开组装成品检验单 → 工具栏「更多」→「选检验项目」→ 弹窗里勾选标准中的检验项目
 *       → 点「带入明细」→ 断言明细表格出现 表区=检验项目 的行(项目/标准要求/检验方法已带出、实测数值留空)。
 *
 * ⚠ 只读:全程**不点保存**,不改库里任何数据(带入只发生在页面内存里)。
 * 用法: node tools/archive/_verify-qc-insp-pick-ui.mjs http://127.0.0.1:8091
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8091').replace(/\/$/, '')
const PANEL = 'QC_ASM_INSP'
const PORT = 9455
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

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-qcpick-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1700,1050',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
try {
  const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map()
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1050, deviceScaleFactor: 1, mobile: false })

  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(user)}); localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
  await send('Page.navigate', { url: `${BASE}/#/panelx/list/${PANEL}` }); await sleep(5200)

  // 明细表格行文本(用于带入前后对比)。
  // ⚠ 该表格有「行填充」占位空行 ⇒ **总行数带入前后一样**,只能用**内容**判定,不能比行数(2026-10-09 踩到)。
  const gridRows = () => ev(`[...document.querySelectorAll('.el-table__body-wrapper tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>(td.innerText||'').trim()).filter(Boolean).join('|'))`)
  const before = await gridRows()
  const beforeItems = before.filter((r) => /目数/.test(r)).length
  console.log(`    [带入前] 表格 ${before.length} 行(含占位空行),其中含「目数」的 ${beforeItems} 行`)
  ok('单据页已渲染(有明细行)', before.length > 0, before.length + ' 行')
  ok('带入前没有目数检验项', beforeItems === 0)

  // 更多 → 选检验项目
  const clickMore = () => ev(`(()=>{const grp=[...document.querySelectorAll('.tb-group')].find(g=>/更多/.test((g.querySelector('.tb-main')||{}).textContent||''));if(!grp)return 'NO_MORE';const c=grp.querySelector('.tb-caret');if(!c)return 'NO_CARET';c.click();return 'CLICKED'})()`)
  for (let i = 0; i < 3 && (await clickMore()) !== 'CLICKED'; i++) await sleep(500)
  await sleep(600)
  const menu = await ev(`[...document.querySelectorAll('.tb-menu .ctx-item')].map(x=>(x.textContent||'').trim()).join('|')`)
  ok('「更多」里有「选检验项目」', /选检验项目/.test(String(menu)), String(menu).slice(0, 160))
  const clicked = await ev(`(()=>{const it=[...document.querySelectorAll('.tb-menu .ctx-item')].filter(x=>x.getBoundingClientRect().height>0).find(x=>/选检验项目/.test(x.textContent||''));if(!it)return 'NO_ITEM';it.click();return 'CLICKED'})()`)
  ok('点开「选检验项目」', clicked === 'CLICKED', clicked)

  const dlg = async () => ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>/选检验项目/.test((x.querySelector('.el-dialog__title')||{}).textContent||''));if(!d)return null;const r=d.getBoundingClientRect();return (r.height>0&&r.width>0)?true:null})()`)
  let up = null
  for (let i = 0; i < 25 && !up; i++) { up = await dlg(); if (!up) await sleep(300) }
  ok('选检验项目弹窗已打开', up === true)

  // 等方案下项目加载出来
  const pickRows = async () => ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>/选检验项目/.test((x.querySelector('.el-dialog__title')||{}).textContent||''));if(!d)return -1;const t=d.querySelector('.el-table');return t?t.querySelectorAll('.el-table__body-wrapper tbody tr').length:-1})()`)
  let n = 0
  for (let i = 0; i < 30; i++) { n = await pickRows(); if (n > 0) break; await sleep(300) }
  ok('弹窗里列出该方案下的检验项目', n > 0, n + ' 行')
  const planTxt = await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>/选检验项目/.test((x.querySelector('.el-dialog__title')||{}).textContent||''));return (d.querySelector('.el-select__selected-item')||{}).innerText||''})()`)
  console.log('    [预选方案] ' + planTxt)
  const pkText = await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>/选检验项目/.test((x.querySelector('.el-dialog__title')||{}).textContent||''));return (d.querySelector('.el-table')||{}).innerText||''})()`)
  ok('弹窗里能看到项目名称/检验标准/检验方法', /目数/.test(String(pkText)) && /检验标准|占比/.test(String(pkText)), String(pkText).slice(0, 120))

  const shot0 = await send('Page.captureScreenshot', { format: 'png' })
  if (shot0?.result?.data) fs.writeFileSync(path.join(HERE, '_shot-qc-insp-pick.png'), Buffer.from(shot0.result.data, 'base64'))

  // 全选 → 带入明细
  await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>/选检验项目/.test((x.querySelector('.el-dialog__title')||{}).textContent||''));const b=[...d.querySelectorAll('button')].find(x=>/全选/.test(x.textContent||''));if(b)b.click();return 'ok'})()`)
  await sleep(500)
  const cnt = await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>/选检验项目/.test((x.querySelector('.el-dialog__title')||{}).textContent||''));const m=(d.innerText||'').match(/已选\\s*(\\d+)\\s*项/);return m?Number(m[1]):-1})()`)
  ok('全选后「已选」计数 = 项目数', cnt === n, `已选 ${cnt} / 项目 ${n}`)
  const apply = await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>/选检验项目/.test((x.querySelector('.el-dialog__title')||{}).textContent||''));const b=[...d.querySelectorAll('.el-dialog__footer button')].find(x=>/带入明细/.test(x.textContent||''));if(!b)return 'NO_BTN';b.click();return 'CLICKED'})()`)
  ok('点「带入明细」', apply === 'CLICKED', apply)
  await sleep(1200)

  const after = await gridRows()
  const added = after.filter((r) => /检验项目/.test(r) && /目数/.test(r))
  console.log(`    [带入后] 表格 ${after.length} 行,其中含「目数」的 ${added.length} 行`)
  ok(`明细分出 ${n} 行带出项目(按内容判定)`, added.length === n, `${beforeItems} → ${added.length}`)
  ok('新行「表区」= 检验项目', added.length === n && added.every((r) => /检验项目/.test(r)), added.join(' / ').slice(0, 200))
  ok('新行带出 检验项目/标准要求/检验方法(实测数值留空)',
    added.every((r) => /目数/.test(r) && /占比/.test(r) && /筛分/.test(r)), added.join(' / ').slice(0, 200))
  ok('原有数量判定行未被破坏(合格/不合格仍在)',
    after.some((r) => /数量判定/.test(r) && /合格/.test(r)) && after.some((r) => /数量判定/.test(r) && /不合格/.test(r)))

  await sleep(500)
  const shot1 = await send('Page.captureScreenshot', { format: 'png' })
  if (shot1?.result?.data) {
    const out = path.join(HERE, '_shot-qc-insp-picked.png')
    fs.writeFileSync(out, Buffer.from(shot1.result.data, 'base64'))
    console.log('    [截图] ' + out)
  }
  console.log('    ⚠ 全程未点保存,库内数据未改动')
} finally { try { edge.kill() } catch { /* ignore */ } }

console.log(`\n[结果] pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
