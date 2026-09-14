/**
 * _insp-align-check.cjs — 出货检验计划表网格对齐验证:
 * 头表/信息行/数据表 右边缘一致;产品编号↔控制项目、客户名↔控制标准及要求、版本号↔检测频率 分界线一致
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9350
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const lr = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })
  const login = await lr.json()
  // 建草稿(编辑态)
  const s1 = await fetch(API + '/px/callButton', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + login.data.token }, body: JSON.stringify({ panelCode: 'RD_INSP_PLAN', buttonName: '保存', formData: {} }) })
  const no = (await s1.json()).data['编号']
  await fetch(API + '/px/callButton', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + login.data.token }, body: JSON.stringify({ panelCode: 'RD_INSP_PLAN', buttonName: '保存', formData: { 编号: no, 标题: '测试对齐', detail: { items: [{ 控制项目: '*外观', 检验: 'IQC' }] } } }) })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-insp-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (m, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })) })
    const evaluate = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 40; i++) { await sleep(300); if ((await evaluate('document.readyState')) === 'complete') { await sleep(1200); return } }
    }
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1800, height: 1000, deviceScaleFactor: 1, mobile: false })
    await navigate(`${FRONT}/#/login`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_login_date', '2026-09-04'); 'ok'`)
    await navigate('about:blank')
    await navigate(`${FRONT}/#/panelx/list/RD_INSP_PLAN`)
    await sleep(3500)
    const out = await evaluate(`(() => {
  const tables = [...document.querySelectorAll('.rsp-sheet > table.rs-t, .rsp-sheet .rsp-dt-table > table.rs-t')]
  const rights = tables.map((t) => +t.getBoundingClientRect().right.toFixed(1))
  // 信息行:产品编号/客户名 值格右缘;数据表:控制项目/控制标准及要求 th 右缘;头表:信息标签右缘
  const infoRow = [...document.querySelectorAll('.rsp-sheet table.rs-t tr')].find((tr) => tr.textContent.includes('产品编号'))
  const prodVal = infoRow ? +infoRow.children[0].getBoundingClientRect().right.toFixed(1) : null   // 产品编号标签右缘
  const custCell = infoRow ? [...infoRow.children].find((td) => td.textContent.includes('客户名')) : null
  const custL = custCell ? +custCell.getBoundingClientRect().left.toFixed(1) : null
  const dtThs = [...document.querySelectorAll('.rsp-sheet .rs-dt .rs-th')]
  const ctrlTh = dtThs.find((th) => th.textContent.trim() === '控制项目')
  const stdTh = dtThs.find((th) => th.textContent.trim() === '控制标准及要求')
  const freqTh = dtThs.find((th) => th.textContent.trim() === '检测频率')
  const headLabel = [...document.querySelectorAll('.rsp-sheet .rs-info-label')][0]
  return {
    rights: [...new Set(rights)],
    产品编号标签右缘: prodVal,
    控制项目th右缘: ctrlTh ? +ctrlTh.getBoundingClientRect().right.toFixed(1) : null,
    客户名标签左缘: custL,
    控制标准th左缘: stdTh ? +stdTh.getBoundingClientRect().left.toFixed(1) : null,
    版本号标签左缘: headLabel ? +headLabel.getBoundingClientRect().left.toFixed(1) : null,
    检测频率th左缘: freqTh ? +freqTh.getBoundingClientRect().left.toFixed(1) : null,
  }
})()`)
    console.log(JSON.stringify(out, null, 1))
    await fetch(API + '/px/callButton', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + login.data.token }, body: JSON.stringify({ panelCode: 'RD_INSP_PLAN', buttonName: '删除', formData: { 编号: no } }) })
    console.log('CLEANED ' + no)
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
