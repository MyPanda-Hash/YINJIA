/*
 * _verify-asm-insp-report-ui.mjs — 「导出报表」入口 + 模板下拉 界面实测(2026-10-16,一次性探针)
 *
 * 链路:登录 → 打开组装成品检验单 → 工具栏「导出报表」可见 → 点开弹窗 →
 *       模板下拉里是「组装成品检验记录表」(且明细列表里已无 数量/实测数值 两列)。
 * ⚠ 只读:不点下载/预览,不改任何数据。
 * 用法: node tools/archive/_verify-asm-insp-report-ui.mjs [http://127.0.0.1:8090] [factory]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const FACTORY = process.argv[3] || 'YJ'
const PANEL = 'QC_ASM_INSP'
const PORT = 9468
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const HERE = import.meta.dirname
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok   - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  | ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-asmrpt-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1760,1080',
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
  await send('Page.navigate', { url: `${BASE}/#/panelx/list/${PANEL}` }); await sleep(6500)

  /* ① 明细列:不该再有 数量/实测数值 */
  const heads = await ev(`[...document.querySelectorAll('.el-table__header th')].map(th=>(th.innerText||'').replace(/[\\s⇅↑↓]+/g,'')).filter(Boolean)`)
  console.log('   明细表头: ' + heads.join('|'))
  ok('明细列已无「数量」', !heads.includes('数量'), heads.join('|'))
  ok('明细列已无「实测数值」', !heads.includes('实测数值'), heads.join('|'))

  /* ② 工具栏「导出报表」可见(前端按 /report/templates 是否为空自动显隐)
     ⚠ 它不是 .tb-group —— 实测是一个独立的 <span class="tb-main"><span class="act-name">导出报表</span></span>
       (走 v-if="reportTemplates.length || user.isAdmin" 单渲染,2026-10-16 探针第一版就是漏了这点) */
  const btn = await ev(`[...document.querySelectorAll('.tb-main,.as-side-btn')].find(x=>/导出报表/.test((x.innerText||'').trim())) ? 'YES' : 'NO'`)
  ok('工具栏出现「导出报表」入口', btn === 'YES', btn)

  /* ③ 点开弹窗 → 模板下拉里是「组装成品检验记录表」 */
  await ev(`(()=>{const m=[...document.querySelectorAll('.tb-main,.as-side-btn')].find(x=>/导出报表/.test((x.innerText||'').trim()));
     if(!m) return 'NO'; m.click(); return 'CLICKED'})()`)
  await sleep(1200)
  const dlg = await ev(`!!document.querySelector('.el-dialog__title') ? [...document.querySelectorAll('.el-dialog__title')].map(x=>x.innerText.trim()).join('|') : ''`)
  console.log('   弹窗标题: ' + dlg)
  ok('「导出报表」弹窗打开', /导出报表/.test(String(dlg)), String(dlg))
  /* el-select 的选中项 Element Plus 不落在 input.value 上(它渲染在 .el-select 内部节点)
     ⇒ 读容器的可见文本(2026-10-16 实测:input.value 为空,读 innerText 才有) */
  const selVal = await ev(`(()=>{const s=document.querySelector('.el-dialog .el-select');return s? (s.innerText||'').trim() : ''})()`)
  console.log('   模板下拉当前值: ' + selVal)
  ok('模板下拉里有「组装成品检验记录表」', /组装成品检验记录表/.test(String(selVal)), String(selVal))
  /* 三个动作(导出 PDF / 打印预览 / 导出 Excel)都在 */
  const acts = await ev(`(()=>{const d=document.querySelector('.el-dialog');return d? (d.innerText||'').replace(/\\s+/g,' ') : ''})()`)
  ok('弹窗提供 导出 PDF / 打印预览 / 导出 Excel',
    /导出 PDF/.test(acts) && /打印预览/.test(acts) && /导出 Excel/.test(acts), String(acts).slice(0, 200))

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  if (shot?.result?.data) {
    const out = path.join(HERE, '_verify-asm-insp-report-ui.png')
    fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
    console.log('   截图: ' + out)
  }
} finally { try { edge.kill() } catch {} }

console.log(`\n==== 结果:${pass} 通过 / ${fail} 失败 ====`)
process.exit(fail > 0 ? 1 : 0)
