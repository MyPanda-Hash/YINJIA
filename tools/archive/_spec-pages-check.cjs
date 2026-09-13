// 快速验证 P2 章节行(1.适用范围/2.整体规格参数/3.产品主要性能)与前 3 页条
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const lr = await fetch('http://localhost:8090/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })
  const login = await lr.json()
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + login.data.token }
  const s1 = await fetch('http://localhost:8090/api/px/callButton', { method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', buttonName: '保存', formData: { 规格书种类: '飞利浦沐浴阻垢滤芯', 名称: '章节验证', 日期: '2026年06月24日', detail: { items: [{ 表区: '修订记录', 序号: 1, 更改内容: '初版' }] } } }) })
  const no = (await s1.json()).data['编号']
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-pv-'))
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9365', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch('http://127.0.0.1:9365/json/new?about:blank', { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
    let seq = 0; const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (m, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })) })
    const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 2400, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: 'http://localhost:5173/#/login' }); await sleep(2000)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_login_date', '2026-09-04'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
    await send('Page.navigate', { url: 'http://localhost:5173/#/panelx/list/RD_SPEC_DOC?focus=' + no }); await sleep(3500)
    await ev(`(() => { const ov = [...document.querySelectorAll('.el-overlay')]; ov.forEach((e) => e.remove()); return ov.length })()`)
    const out = await ev(`(async () => {
  const vis = (e) => { let el = e; while (el && el !== document.body) { const st = getComputedStyle(el); if (st.display === 'none' || st.visibility === 'hidden') return false; el = el.parentElement } return true }
  const res = {}
  const click = async (t) => { const el = [...document.querySelectorAll('.rsp-page-tab')].find((e) => e.textContent.includes(t)); if (el) el.click(); await new Promise((r) => setTimeout(r, 400)) }
  await click('修订记录'); res.p1 = { bars: [...document.querySelectorAll('.rs-sectionbar,.rsp-plain-title')].filter(vis).map((e) => e.textContent.trim()) }
  await click('检验项目'); res.p2 = { docs: [...document.querySelectorAll('.rsp-doclabel')].filter(vis).map((e) => e.textContent.trim()), bars: [...document.querySelectorAll('.rs-sectionbar,.rsp-plain-title')].filter(vis).map((e) => e.textContent.trim()) }
  await click('成品'); res.p3 = { docs: [...document.querySelectorAll('.rsp-doclabel')].filter(vis).map((e) => e.textContent.trim()), bars: [...document.querySelectorAll('.rs-sectionbar,.rsp-plain-title')].filter(vis).map((e) => e.textContent.trim()) }
  return res
})()`)
    console.log('PAGES:', JSON.stringify(out, null, 1))
    await fetch('http://localhost:8090/api/px/callButton', { method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', buttonName: '删除', formData: { 编号: no }, buttonParam: {} }) })
    console.log('CLEANED ' + no)
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
