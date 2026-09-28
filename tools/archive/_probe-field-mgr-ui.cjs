/* 字段管理(动态字段)UI 探针:PARTNER 面板真实界面走一遍 绑定→可见→清理,全程截图 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('ws')
const PORT = 9347
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(process.env.TEMP || os.tmpdir(), 'yj-field-mgr-ui')
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const LABEL = 'EXT_界面测试' + Date.now().toString(36).slice(-4)

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })
  const login = await loginRes.json()
  const token = login.data.token
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-fm-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,900',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(1200); return } } }
    const shot = async (name) => {
      let r = await send('Page.captureScreenshot', { format: 'png' })
      if (!r?.result?.data) { await sleep(600); r = await send('Page.captureScreenshot', { format: 'png' }) }
      if (!r?.result?.data) { console.log('shot FAIL:', name, JSON.stringify(r).slice(0, 200)); return }
      fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64')); console.log('shot:', name)
    }
    await send('Page.enable'); await send('Runtime.enable')

    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); 'ok'`)
    // ⚠ 必须先离开再进:同源 hash 跳转不重载页面,内存 user store 仍是空 token → 守卫踢回登录
    await navigate('about:blank')
    await navigate('http://localhost:5173/#/panelx/list/PARTNER')
    await sleep(3000)
    // 关掉可能挡路的初始化向导(.wz-skip 不是 button,是 div)
    const dismissed = await evaluate(`(() => { const b = document.querySelector('.wz-skip'); if (b) { b.click(); return 'dismissed' } return 'no-wizard' })()`)
    console.log('初始化向导:', dismissed)
    await sleep(600)
    await shot('1-panel.png')

    // 打开「更多」组的下拉(顶部工具栏 .tb-caret),点「字段管理」(.ctx-item)
    const opened = await evaluate(`(() => {
      const groups = Array.from(document.querySelectorAll('.tb-group'))
      const g = groups.find(x => (x.querySelector('.act-name') || {}).textContent === '更多')
      if (!g) return 'group-notfound'
      const caret = g.querySelector('.tb-caret')
      if (!caret) return 'caret-notfound'
      caret.click()
      return 'opened'
    })()`)
    console.log('更多下拉:', opened)
    await sleep(900)
    await shot('2-more-dropdown.png')
    const entry = await evaluate(`(() => {
      const item = Array.from(document.querySelectorAll('.tb-menu .ctx-item')).find(e => e.textContent.trim() === '字段管理')
      if (item) { item.click(); return 'clicked' } return 'notfound'
    })()`)
    console.log('字段管理入口:', entry)
    await sleep(1400)
    await shot('3-dialog.png')
    const dlg = await evaluate(`!!document.querySelector('.el-dialog') && Array.from(document.querySelectorAll('.el-dialog__title')).some(t => t.textContent.includes('字段管理'))`)
    console.log('弹窗标题含 字段管理:', dlg)

    // 填表并提交
    const filled = await evaluate(`(async () => {
      const setVal = (el, v) => { const p = Object.getPrototypeOf(el); Object.getOwnPropertyDescriptor(p, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
      const inputs = Array.from(document.querySelectorAll('.el-dialog .el-input__inner'))
      if (inputs.length < 2) return 'inputs=' + inputs.length
      setVal(inputs[0], ${JSON.stringify(LABEL)})
      setVal(inputs[1], 'UI Test Field')
      const btns = Array.from(document.querySelectorAll('.el-dialog__footer button'))
      const add = btns.find(b => b.textContent.trim() === '添加')
      if (!add) return 'no-add-btn'
      add.click()
      return 'submitted'
    })()`)
    console.log('表单提交:', filled)
    await sleep(2200)
    await evaluate(`document.querySelector('.el-dialog__headerbtn') && document.querySelector('.el-dialog__headerbtn').click(); 'closed'`)
    await sleep(1500)
    await shot('4-after-add.png')
    const colInGrid = await evaluate(`Array.from(document.querySelectorAll('.el-table__header th, thead th, .grid-header, [class*=column]')).some(e => e.textContent.includes(${JSON.stringify(LABEL)})) || document.body.innerText.includes(${JSON.stringify(LABEL)})`)
    console.log('界面出现新字段:', colInGrid)

    // 清理:退绑
    const ov = await (await fetch('http://localhost:8090/api/px/extFields?panel=PARTNER', { headers: { Authorization: 'Bearer ' + token } })).json()
    const fid = (ov.data?.fields || []).find(f => f.label === LABEL)?.id
    if (fid) {
      const del = await fetch('http://localhost:8090/api/px/extField/retire', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ panel: 'PARTNER', fieldId: fid }) })
      console.log('清理退绑:', del.status)
    } else console.log('清理:未找到字段(可能提交失败)')
    console.log('OUT:', OUT)
  } finally { edge.kill() }
}
main().then(() => process.exit(0)).catch(e => { console.error('FATAL', e); process.exit(2) })
