/* YINJIA-MES UI 冒烟(Edge headless + CDP,Node >=20 --experimental-websocket)
   用法: node --experimental-websocket tools/ui-smoke.cjs [panelCode]
   验证:登录 → 打开面板 → 读取工具栏按钮与状态 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const PANEL = process.argv[2] || 'RKD'
// 参数以 # 开头时视为完整路由(如 #/sys/org),否则按面板代码拼 /panelx/list/<code>
const HASH = PANEL.startsWith('#') ? PANEL : `#/panelx/list/${PANEL}`
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090'
const PORT = 9333
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  // 1. 登录取 token
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const login = await loginRes.json()
  if (!login.data?.token) throw new Error('登录失败: ' + JSON.stringify(login))
  const user = login.data.user
  console.log(`[login] ok admin=${user.isAdmin} approvePanels=${JSON.stringify(user.approvePanels)}`)

  // 2. 启动 Edge headless
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-edge-'))
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' })
  await sleep(2500)

  try {
    // 3. 开标签页
    const newRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
    const tab = await newRes.json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
    }
    const send = (method, params = {}) => new Promise((res) => {
      const id = ++seq
      pending.set(id, res)
      ws.send(JSON.stringify({ id, method, params }))
    })
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
      return r.result?.result?.value
    }
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 40; i++) {
        await sleep(300)
        const ready = await evaluate('document.readyState')
        if (ready === 'complete') { await sleep(600); return }
      }
    }

    await send('Page.enable')
    await send('Runtime.enable')

    // 4. 打开登录页(建立 origin)→ 注入凭据 → 整页重载(应用启动时才读 localStorage)→ 跳面板
    await navigate(`${FRONT}/#/login`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date', '2026-08-29'); 'ok'`)
    await navigate('about:blank')
    await navigate(`${FRONT}/${HASH}`)
    await sleep(3500)

    // 5. 读取工具栏(组织架构等系统页读取页面要点)
    const title = await evaluate('document.title')
    console.log(`[title] ${title}`)
    if (HASH.includes('/sys/')) {
      const deptNames = await evaluate(`[...document.querySelectorAll('.dept-tree .dept-node > span:first-child')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 30)`)
      console.log(`[dept-tree]`, JSON.stringify(deptNames))
      // 展开全部两级验证子部门
      await evaluate(`[...document.querySelectorAll('.dept-tree .el-tree-node__expand-icon')].slice(0, 3).forEach(e => e.click()); 'ok'`)
      await sleep(800)
      await evaluate(`[...document.querySelectorAll('.dept-tree .el-tree-node__expand-icon')].slice(0, 6).forEach(e => e.click()); 'ok'`)
      await sleep(800)
      const deptAll = await evaluate(`[...document.querySelectorAll('.dept-tree .dept-node > span:first-child')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 30)`)
      console.log(`[dept-tree expanded]`, JSON.stringify(deptAll))
      const userRows = await evaluate(`[...document.querySelectorAll('.el-table__row')].slice(0, 5).map(r => r.textContent.trim().replace(/\\s+/g, ' ').slice(0, 80))`)
      console.log(`[table-rows]`, JSON.stringify(userRows))
      // 点击角色表的"普通用户"行(非管理员)加载面板授权分组
      await evaluate(`(() => {
        const rows = [...document.querySelectorAll('.org-col.roles .el-table__row')]
        const target = rows.find(r => r.textContent.includes('普通用户')) || rows[rows.length - 1]
        target?.click(); return 'ok'
      })()`)
      await sleep(1500)
      const moduleTitles = await evaluate(`[...document.querySelectorAll('.perm-collapse .g-title')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 10)`)
      console.log(`[role-panel-modules]`, JSON.stringify(moduleTitles))
      // 展开第一个模块的折叠面板,读取操作权限表头
      await evaluate(`document.querySelector('.perm-collapse .el-collapse-item__header')?.click(); 'ok'`)
      await sleep(600)
      const permHeaders = await evaluate(`[...document.querySelectorAll('.perm-table thead th')].map(e => e.textContent.trim()).filter(Boolean)`)
      console.log(`[perm-headers]`, JSON.stringify(permHeaders))
      const permRows = await evaluate(`[...document.querySelectorAll('.perm-table tbody tr')].slice(0, 3).map(r => ({
        panel: r.querySelector('.pt-panel')?.textContent?.trim(),
        checkedCount: [...r.querySelectorAll('.pt-act input[type=checkbox]')].filter(c => c.checked).length,
      }))`)
      console.log(`[perm-rows]`, JSON.stringify(permRows))
      const toast = await evaluate(`[...document.querySelectorAll('.el-message')].map(e => e.textContent.trim()).join(' | ')`)
      console.log(`[toast] ${toast}`)
      ws.close()
      return
    }
    const buttons = await evaluate(`[...document.querySelectorAll('.tools .tb-main')].map(e => ({
  name: e.querySelector('.act-name')?.textContent?.trim(),
  disabled: e.classList.contains('disabled'),
}))`)
    console.log(`[toolbar ${PANEL}]`, JSON.stringify(buttons))
    const chip = await evaluate(`document.querySelector('.tools .doc-chip')?.textContent?.trim() || ''`)
    const status = await evaluate(`document.querySelector('.tools .doc-status')?.textContent?.trim() || ''`)
    console.log(`[current] ${chip} ${status}`)

    // 6. 下拉组数量 + 实点「审批」主按钮(执行首个动作=提交审批)验证状态变化
    const dropInfo = await evaluate(`[...document.querySelectorAll('.tools .tb-caret')].length`)
    console.log(`[dropdowns] ${dropInfo} 个组带下拉`)
    const clicked = await evaluate(`(() => {
  const btn = [...document.querySelectorAll('.tools .tb-main')].find(e => e.querySelector('.act-name')?.textContent?.trim() === '审批')
  if (!btn) return 'NOT_FOUND'
  btn.click(); return 'CLICKED'
})()`)
    console.log(`[click 审批] ${clicked}`)
    await sleep(2500)
    const status2 = await evaluate(`document.querySelector('.tools .doc-status')?.textContent?.trim() || ''`)
    console.log(`[status after click] ${status2}`)
    const toast = await evaluate(`[...document.querySelectorAll('.el-message')].map(e => e.textContent.trim()).join(' | ')`)
    console.log(`[toast] ${toast}`)
    const box = await evaluate(`document.querySelector('.el-message-box') ? (document.querySelector('.el-message-box .el-message-box__title')?.textContent?.trim() + ' / ' + document.querySelector('.el-message-box__message')?.textContent?.trim()) : 'NONE'`)
    console.log(`[dialog] ${box}`)
    // 确认提交审批
    const confirmed = await evaluate(`(() => {
      const btn = [...document.querySelectorAll('.el-message-box__btns .el-button--primary')][0]
      if (!btn) return 'NO_BTN'
      btn.click(); return 'CONFIRMED'
    })()`)
    console.log(`[confirm] ${confirmed}`)
    await sleep(3000)
    const status3 = await evaluate(`document.querySelector('.tools .doc-status')?.textContent?.trim() || ''`)
    console.log(`[status after confirm] ${status3}`)
    const toast3 = await evaluate(`[...document.querySelectorAll('.el-message')].map(e => e.textContent.trim()).join(' | ')`)
    console.log(`[toast] ${toast3}`)

    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
