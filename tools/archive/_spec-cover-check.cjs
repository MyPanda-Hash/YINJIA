/**
 * _spec-cover-check.cjs — 规格书封面几何验证(设计图 708×1173 像素复刻)
 * 前端 dev server http://localhost:5173,后端 http://localhost:8090
 * 期望(设计 px × coverK,coverK=gridW/708):公司ink(15,19) 标题中心x=367.5 字段行ink-y[467..802] 签名表(132,990,473)
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const lr = await fetch('http://localhost:8090/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })
  const login = await lr.json()
  const s1 = await fetch('http://localhost:8090/api/px/callButton', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + login.data.token }, body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', buttonName: '保存', formData: {} }) })
  const no = (await s1.json()).data['编号']
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-cv-'))
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9359', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch('http://127.0.0.1:9359/json/new?about:blank', { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (m, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })) })
    const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: 'http://localhost:5173/#/login' })
    await sleep(2000)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_login_date', '2026-09-04'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' })
    await sleep(400)
    await send('Page.navigate', { url: 'http://localhost:5173/#/panelx/list/RD_SPEC_DOC' })
    await sleep(3500)
    const out = await ev(`(() => {
  const rect = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) } }
  const page = rect('.rsp-cover-page')
  const k = page.w / 708
  const dx = (v) => +(v * k).toFixed(1)
  const lines = [...document.querySelectorAll('.rsp-cover-line')].map((e) => { const r = e.getBoundingClientRect(); return { x: +(r.x - page.x).toFixed(1), y: +(r.y - page.y).toFixed(1) } })
  const sign = rect('.rsp-sign-t')
  return {
    page: { w: page.w, h: page.h, k: +k.toFixed(4) },
    company: (() => { const r = document.querySelector('.rsp-cover-company').getBoundingClientRect(); return { x: +(r.x - page.x).toFixed(1), y: +(r.y - page.y).toFixed(1), fs: getComputedStyle(document.querySelector('.rsp-cover-company')).fontSize } })(),
    title: (() => { const r = document.querySelector('.rsp-cover-title').getBoundingClientRect(); return { cx: +(r.x + r.width / 2 - page.x).toFixed(1), y: +(r.y - page.y).toFixed(1) } })(),
    lines,
    sign: sign ? { x: +(sign.x - page.x).toFixed(1), y: +(sign.y - page.y).toFixed(1), w: sign.w, h: sign.h } : null,
    signHead: [...document.querySelectorAll('.rsp-sign-th')].map((e) => e.textContent.trim()),
    exp: { k: k, lx: dx(173).toFixed(1), tops: [467, 534, 601, 668, 735, 802].map((v) => dx(v).toFixed(1)), signXY: [dx(132), dx(990)].map((v) => v.toFixed(1)) },
  }
})()`)
    console.log(JSON.stringify(out, null, 1))
    await fetch('http://localhost:8090/api/px/callButton', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + login.data.token }, body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', buttonName: '删除', formData: { 编号: no }, buttonParam: {} }) })
    console.log('CLEANED ' + no)
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
