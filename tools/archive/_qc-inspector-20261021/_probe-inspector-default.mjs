/*
 * _probe-inspector-default.mjs — 首件/制程/组装成品三张检验单的「检验人员」默认值(2026-10-21)
 *
 * 用户口径:「将当前首件检验单,制程检验单,组装成品检验单的检验人员都填写默认当前电脑端的用户
 * 而不是 system(手机端报工吸收)」。
 *
 * 验什么(界面,CDP + Edge headless;5173 源码版 / 8090 打包版都行):
 *   ① 打开**检验员=system(手机端报工吸收)**的历史草稿 ⇒ 检验人员显示为当前登录人姓名;
 *   ② 打开**检验员=空**的历史草稿 ⇒ 同样带出当前登录人姓名;
 *   ③ 打开**检验员=真人姓名**的单 ⇒ 原样显示,不被覆盖(签名是事实);
 *   ④ 无未捕获运行时异常。
 *
 * 用法: node tools/archive/_qc-inspector-20261021/_probe-inspector-default.mjs [base] [factory]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '')
const FACTORY = process.argv[3] || 'YJ'
const PORT = 9498
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

// 探针用单据(正式账套实测):system 占位 / 空值 / 真人姓名各一张
const CASES = [
  {
    code: 'QC_PROC_INSP', name: '制程检验单', docNo: 'ZC-2026-10-0131', stored: 'system(手机端报工吸收)',
    read: `document.querySelector('.qr-insp-input input')?.value ?? null`,
  },
  {
    code: 'QC_FIRST_INSP', name: '首件检验单', docNo: 'SJ-2026-10-0167', stored: 'system(手机端报工吸收)',
    read: `(document.querySelector('.fi-foot tr > *:nth-child(4)')?.innerText || '').trim()`,
  },
  {
    code: 'QC_ASM_INSP', name: '组装成品检验单', docNo: 'ZJ-2026-10-0007', stored: '',
    read: `(() => { const f = [...document.querySelectorAll('.header-fields .field')].find((x) => (x.querySelector('label')?.innerText || '').includes('检验员')); return f ? (f.querySelector('input')?.value ?? f.querySelector('.el-input__inner')?.value ?? '') : null })()`,
  },
  {
    code: 'QC_PROC_INSP', name: '制程检验单(已有值:admin)', docNo: 'ZC-2026-10-0127', stored: 'admin',
    read: `document.querySelector('.qr-insp-input input')?.value ?? null`, expect: 'admin',
  },
]

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const realName = login.data.user?.realName || login.data.user?.userName || ''
console.log(`登录人姓名=${JSON.stringify(realName)}`)

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-insp-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1800,1000', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000)
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ }
}
if (!tab) { console.error('Edge 启动失败'); process.exit(1) }

let ws = null
try {
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map(); const errs = []
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails?.exception?.description || '').slice(0, 200))
  }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value

  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1800, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))});
    localStorage.setItem('mes_init_done','1'); 'ok'`)

  for (const c of CASES) {
    console.log(`\n=== ${c.name} ${c.docNo}(库值:${JSON.stringify(c.stored)}) ===`)
    await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/${c.code}?docNo=${encodeURIComponent(c.docNo)}` })
    // 等单据加载:纸面/表头字段出现且「检验人员」格有值(最多 30s)
    let got = null
    for (let i = 0; i < 60; i++) {
      await sleep(500)
      got = await ev(c.read)
      if (got) break
    }
    console.log(`  界面检验人员=${JSON.stringify(got)}`)
    const expect = c.expect || realName
    if (c.expect) ok('③ 已有值原样保留(不被当前登录人覆盖)', got === expect, String(got))
    else ok('①/② 显示当前电脑端登录人姓名(不是 system)', got === expect, String(got))
  }

  ok('④ 无未捕获运行时异常', errs.length === 0, errs.join(' | '))
  ws.close()
} finally {
  try { edge.kill() } catch { /* ignore */ }
  try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
}
console.log(`\n===== PASS=${pass} FAIL=${fail} =====`)
process.exit(fail ? 1 : 0)
