// 字段管理弹窗「关闭」按钮回归探针(红→绿)
// 背景:2026-09-28 用户报「字段管理点关闭无反应,只能 ×」——根因是 FieldManagerDialog
//       声明的是 visible prop / update:visible 事件,而父组件用 v-model(modelValue)。
// 用法:node --experimental-websocket tools/verify/ext-field-dialog-close.cjs [baseUrl]
// 断言:① 更多→字段管理 能打开弹窗;② 点页脚「关闭」弹窗消失;③ 重开后点 × 也消失。
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')

const BASE = process.argv[2] || 'http://localhost:5173'
const API = 'http://localhost:8090'
const PANEL = 'PARTNER'
const PORT = 9451
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  }).then((r) => r.json())
  if (!login.data?.token) throw new Error('登录失败')
  const token = login.data.token, user = JSON.stringify(login.data.user)

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-fm-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--window-size=1440,900`,
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  let pass = 0, fail = 0
  const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }
  try {
    const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
    const evaluate = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

    // 会话准备(E6:注入后必须经 about:blank 强制真加载;E7:弹窗可见性用 rect,不用 offsetParent)
    await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1200)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(user)}); localStorage.setItem('mes_init_done','1'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
    await send('Page.navigate', { url: `${BASE}/#/panelx/list/${PANEL}` }); await sleep(4500)

    const dialogVisible = () => evaluate(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>(x.innerText||'').includes('字段管理'));if(!d)return false;const r=d.getBoundingClientRect();return r.height>0&&r.width>0;})()`)
    // 工具栏是自绘结构:组名在 span.tb-main,下拉由同组的 .tb-caret(▼)切换,菜单项是 .ctx-item
    // (不能点 .tb-main —— 那会触发组内首个动作)
    const clickMore = () => evaluate(`(()=>{const grp=[...document.querySelectorAll('.tb-group')].find(g=>/更多/.test((g.querySelector('.tb-main')||{}).textContent||''));if(!grp)return 'NO_MORE';const c=grp.querySelector('.tb-caret');if(!c)return 'NO_CARET';c.click();return 'CLICKED'})()`)
    const clickMenuItem = () => evaluate(`(()=>{const it=[...document.querySelectorAll('.tb-menu .ctx-item')].filter(x=>x.getBoundingClientRect().height>0).find(x=>/字段管理/.test(x.textContent||''));if(!it)return 'NO_ITEM';it.click();return 'CLICKED'})()`)
    const noToast = () => evaluate(`document.querySelectorAll('.el-message').length===0?'CLEAR':'BUSY'`)
    const clickFooterClose = () => evaluate(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>(x.innerText||'').includes('字段管理'));if(!d)return 'NO_DLG';const f=d.querySelector('.el-dialog__footer')||d;const b=[...(f.querySelectorAll('button'))].find(x=>/关闭/.test(x.textContent||''));if(!b)return 'NO_BTN';b.click();return 'CLICKED'})()`)
    const clickX = () => evaluate(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>(x.innerText||'').includes('字段管理'));if(!d)return 'NO_DLG';const b=d.querySelector('.el-dialog__headerbtn');if(!b)return 'NO_X';b.click();return 'CLICKED'})()`)
    const wait = async (fn, ms, tag) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await fn()) === true) return true; await sleep(150) } return false }

    // ① 打开
    ok('面板页已渲染表格', (await evaluate(`!!document.querySelector('.el-table__row')||!!document.querySelector('.el-empty')`)) === true)
    for (let i = 0; i < 3 && (await clickMore()) !== 'CLICKED'; i++) await sleep(500)
    await sleep(700)
    ok('打开 更多 → 字段管理', (await clickMenuItem()) === 'CLICKED')
    ok('弹窗出现', await wait(dialogVisible, 5000))

    // ② 点页脚「关闭」(被测缺陷)
    for (let i = 0; i < 10 && (await noToast()) !== 'CLEAR'; i++) await sleep(200)   // E14:提示条让位
    const fc = await clickFooterClose()
    ok('点到了页脚「关闭」按钮', fc === 'CLICKED', fc)
    await sleep(900)
    ok('点「关闭」后弹窗消失(缺陷回归点)', (await dialogVisible()) === false)

    // ③ 重开后点 ×
    if (!(await dialogVisible())) {
      for (let i = 0; i < 3 && (await clickMore()) !== 'CLICKED'; i++) await sleep(500)
      await sleep(700); await clickMenuItem(); await wait(dialogVisible, 5000)
    }
    const xc = await clickX()
    await sleep(900)
    ok('点 × 后弹窗消失(对照)', xc === 'CLICKED' && (await dialogVisible()) === false)

    console.log(`\n结果: pass=${pass} fail=${fail}`)
    console.log(fail === 0 ? 'RESULT: PASS' : 'RESULT: FAIL-' + fail)
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error('[FATAL] ' + e.message); process.exit(2) })
