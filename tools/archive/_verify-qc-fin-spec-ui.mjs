/*
 * _verify-qc-fin-spec-ui.mjs — 「成品检验规范」统一文档四页 界面实测(2026-10-09,一次性探针)
 * 断言:四条页签(文件修订履历/正文/检验项目/处理方式) + 各页内容来自播种示例
 *       + 检验项目页按「检验对象」分节(原料(Y-CAS-23) / 成品(CAS-18)) + 处理方式页含 入库/退货/重新筛分。
 * 只读:不改数据。用法: node tools/archive/_verify-qc-fin-spec-ui.mjs http://127.0.0.1:8092
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8092').replace(/\/$/, '')
const PORT = 9461
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const HERE = import.meta.dirname
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: BASE.includes('8092') ? 'YJ_TEST' : 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const token = login.data.token, user = JSON.stringify(login.data.user)

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-finspec-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1150',
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
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1150, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(user)}); localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
  await send('Page.navigate', { url: `${BASE}/#/panelx/list/QC_FIN_SPEC` }); await sleep(6000)

  // 纸张格子的值在 input.value 里(2026-10-09 踩过)
  const snapshot = () => ev(`(()=>{const t=document.body.innerText||'';const v=[...document.querySelectorAll('input,textarea')].map(x=>x.value).filter(Boolean).join(' | ');return t+'\\n@@V@@\\n'+v})()`)
  const tabs = await ev(`[...document.querySelectorAll('.rsp-page-tab')].map(x=>(x.innerText||'').trim())`)
  console.log('    tabs = ' + JSON.stringify(tabs))
  ok('① 四条页签(修订履历/正文/检验项目/处理方式)',
    ['文件修订履历', '正文', '检验项目', '处理方式'].every((t) => (tabs || []).some((x) => x.includes(t))), JSON.stringify(tabs).slice(0, 160))

  const clickTab = (t) => ev(`(()=>{const el=[...document.querySelectorAll('.rsp-page-tab')].find(x=>(x.innerText||'').includes(${JSON.stringify(t)}));if(!el)return 'NO';el.click();return 'OK'})()`)
  const p1 = String(await snapshot())
  ok('② 页1 修订履历显示 A0/首次发行', /A0/.test(p1) && /首次发行/.test(p1))
  // ⚠ 页1 是 showHead:false(照文档:修订履历页自成一张表头,不出报告头信息栏) ⇒ 信息栏断言放在页2
  ok('② 页1 不出报告头信息栏(照文档口径)', !/管控状态/.test(p1))

  ok('③ 切到「正文」页', (await clickTab('正文')) === 'OK')
  await sleep(1000)
  const p2 = String(await snapshot())
  ok('③ 正文五段齐全(目的/范围/职责和权限/取样要求/工作程序)',
    ['目的', '范围', '职责和权限', '取样要求', '工作程序'].every((k) => p2.includes(k)))
  ok('③ 正文页含关联信息(工单号)+签署(制定/审核/核准)', /工单号/.test(p2) && /制定/.test(p2) && /核准/.test(p2))
  ok('③ 正文页报告头有 文件编号/版本版次/管控状态', /YJ-Q-125/.test(p2) && /受控/.test(p2))

  ok('④ 切到「检验项目」页', (await clickTab('检验项目')) === 'OK')
  await sleep(1200)
  const p3 = String(await snapshot())
  ok('④ 检验项目页按检验对象分节(原料(Y-CAS-23) / 成品(CAS-18))', /原料（Y-CAS-23）/.test(p3) && /成品（CAS-18）/.test(p3), p3.replace(/\s+/g, ' ').slice(0, 200))
  ok('④ 检验项目页显示 检验项目/称料/接受标准/检验方法', /性能/.test(p3) && /40g/.test(p3) && /余氯去除率/.test(p3) && /浸泡/.test(p3))
  const shot1 = await send('Page.captureScreenshot', { format: 'png' })
  if (shot1?.result?.data) fs.writeFileSync(path.join(HERE, '_shot-qc-fin-spec-items.png'), Buffer.from(shot1.result.data, 'base64'))

  ok('⑤ 切到「处理方式」页', (await clickTab('处理方式')) === 'OK')
  await sleep(1200)
  const p4 = String(await snapshot())
  ok('⑤ 处理方式页含 合格处置/不合格处置(入库/退货/重新筛分)', /入库/.test(p4) && /退货/.test(p4) && /重新筛分/.test(p4), p4.replace(/\s+/g, ' ').slice(0, 200))
  const shot2 = await send('Page.captureScreenshot', { format: 'png' })
  if (shot2?.result?.data) {
    const out = path.join(HERE, '_shot-qc-fin-spec-disposal.png')
    fs.writeFileSync(out, Buffer.from(shot2.result.data, 'base64'))
    console.log('    [截图] ' + out)
  }
} finally { try { edge.kill() } catch { /* ignore */ } }
console.log(`\n[结果] pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
