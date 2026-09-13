/**
 * _spec-cover-shot.cjs — 截图封面(画布缩到 708px 宽=设计图同分辨率)并输出 PNG 供像素比对
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
  const s1 = await fetch('http://localhost:8090/api/px/callButton', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + login.data.token }, body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', buttonName: '保存', formData: { 规格书种类: '飞利浦沐浴阻垢滤芯', 名称: '伊可普高品质功能炭棒', 客户名: '青岛伊可普', 客户料号: '3-01-01-0014', 版本: 'V20260624', 日期: '2026年06月24日', 制订日期: '陈秀丽/2026/06/24', detail: { items: [{ 表区: '修订记录', 序号: 1, 更改内容: '初版发布', 更改原因: '新规格', 更改时间: '2026-06-24', 责任人: '陈秀丽' }] } } }) })
  const no = (await s1.json()).data['编号']
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-cs-'))
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9361', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch('http://127.0.0.1:9361/json/new?about:blank', { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (m, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })) })
    const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 2400, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: 'http://localhost:5173/#/login' })
    await sleep(2000)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_login_date', '2026-09-04'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' })
    await sleep(400)
    await send('Page.navigate', { url: 'http://localhost:5173/#/panelx/list/RD_SPEC_DOC?focus=' + no })
    await sleep(3500)
    // 首次访问"三步指引"向导浮层:移除带遮罩的顶层包裹元素
    await ev(`(() => {
  const cands = [...document.querySelectorAll('body > div')].filter((e) => /行业配置|开始配置|下次再说/.test(e.textContent || '') && e.querySelector('[style*="position: fixed"], .el-overlay, [class*="guide"], [class*="wizard"]'))
  cands.forEach((e) => e.remove())
  const ov = [...document.querySelectorAll('.el-overlay')]; ov.forEach((e) => e.remove())
  return cands.length + '|' + ov.length
})()`)
    await sleep(800)
    await sleep(3000)
    const diag = await ev(`(() => {
  const tabs = [...document.querySelectorAll('.rsp-page-tab')].map((e) => e.textContent.trim())
  const status = document.querySelector('.doc-status')?.textContent?.trim() || null
  const vals = [...document.querySelectorAll('.rsp-cover-line')].map((e) => e.textContent.trim())
  const sign = [...document.querySelectorAll('.rsp-sign-td')].map((e) => e.textContent.trim())
  const pageNo = document.querySelector('.page-no')?.textContent?.trim() || null
  return { tabs, status, vals, sign, pageNo }
})()`)
    console.log('DIAG:', JSON.stringify(diag, null, 1))
    // captureBeyondViewport:clip 使用文档坐标(非视口坐标)
    await ev(`window.scrollTo(0, 0); 'ok'`)
    await sleep(400)
    const rect = await ev(`(() => { const r = document.querySelector('.rsp-cover-page').getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] })()`)
    const [px_, py_, pw, ph] = rect
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    if (shot.error || !shot.result) { console.log('CAPTURE ERROR:', JSON.stringify(shot.error || shot)); process.exit(1) }
    fs.writeFileSync('C:/INCER/YINJIA-MES/tools/_cover-full.png', Buffer.from(shot.result.data, 'base64'))
    console.log('full saved', fs.statSync('C:/INCER/YINJIA-MES/tools/_cover-full.png').size, 'bytes', 'rect', JSON.stringify(rect))
    await fetch('http://localhost:8090/api/px/callButton', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + login.data.token }, body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', buttonName: '删除', formData: { 编号: no }, buttonParam: {} }) })
    console.log('CLEANED ' + no)
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
