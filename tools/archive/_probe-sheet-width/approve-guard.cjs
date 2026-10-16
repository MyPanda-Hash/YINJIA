/**
 * 取证:产品信息表「提交人不能自己点一级审批通过」前端闸门(2026-10-16 用户报障)
 *
 * 复现根因(测试账套 PI-2026-10-0021:提交人 cp,cp 又有 RD_PROD_INFO 审批权):
 *   cp 点「审批通过」→ 弹**一级**的「选取二级审核人」→ 确认 → 后端 403
 *   「审批人不能与提交人相同（编制与审批分离）」;一级没落地 ⇒ 单子仍「审批中」,
 *   报错后弹窗不关 ⇒ 用户看到的就是"还是显示选取二级审核人"。
 * 本探针验的是**修完之后的界面**:cp 打开这张单时「审批通过」应当是灰的、点了要说人话。
 *
 * 用法:node approve-guard.cjs [URL] [用户名] [密码] [单据编号]
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const URL_ = (process.argv[2] || 'http://127.0.0.1:8090/').replace(/\/$/, '')
const USER = process.argv[3] || 'cp'
const PASS = process.argv[4] || '123456'
const DOC = process.argv[5] || 'PI-2026-10-0021'
const PORT = 9403
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const chk = (name, ok, detail) => {
  console.log(`  ${ok ? '\u2713' : '\u2717'} ${name}${detail === undefined ? '' : '  → ' + String(detail).slice(0, 300)}`)
  if (!ok) fails++
}

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-'))
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1100', 'about:blank'], { stdio: 'ignore' })
  try {
    let target = null
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(300)
      try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page') } catch {}
    }
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let id = 0; const pend = new Map()
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
    const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
    const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable')

    const lr = await fetch(URL_ + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ userName: USER, password: PASS, factory: 'YJ_TEST' }),
    })
    const lj = await lr.json()
    console.log(`[登录 ${USER}]`, lr.status, 'code=' + lj?.code, 'real=' + lj?.data?.user?.realName)
    if (!lj?.data?.token) throw new Error('登录失败: ' + JSON.stringify(lj).slice(0, 160))

    await send('Page.navigate', { url: URL_ + '/#/login' }); await sleep(2500)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user || {}))});
localStorage.setItem('mes_login_date','2026-10-16'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
    await send('Page.navigate', { url: `${URL_}/#/panelx/list/RD_PROD_INFO?docNo=${DOC}` }); await sleep(10000)

    const dump = await ev(`JSON.stringify((() => {
      const txt = (el) => (el.textContent || '').replace(/\\s+/g, ' ').trim()
      const side = document.querySelector('.approval-side')
      const btns = side ? [...side.querySelectorAll('.as-side-btn')] : []
      const apv = btns.find((b) => txt(b) === '审批通过')
      return {
        no: (document.querySelector('.as-side-pager .page-no') || {}).textContent || '',
        status: (document.querySelector('.as-side .doc-status') || {}).textContent || '',
        sideButtons: btns.map((b) => txt(b) + (b.className.includes('disabled') ? ' [灰]' : '')),
        hasApprovePass: !!apv,
        approveDisabled: apv ? apv.className.includes('disabled') : null,
        docnoOnPaper: (document.querySelector('.as-docno') || {}).textContent || '',
        bodyHead: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 260),
      }
    })())`)
    console.log('[页面]', dump)
    const d = JSON.parse(dump)
    chk('① 打开的是目标单据', String(d.bodyHead).includes(DOC), `页面内有 ${DOC}：${String(d.bodyHead).includes(DOC)}`)

    // 产品信息表的「审批通过」在「申请修改 ▼」的下拉里(不是侧栏独立按钮)。
    // ⚠ 侧栏有两个 caret(删除行 / 申请修改行)且都可能已在 DOM 里 —— 全点开再按文案选,别按位置猜。
    const openMenu = await ev(`(() => { const cs = [...document.querySelectorAll('.approval-side .as-side-caret')]; cs.forEach((c) => c.click()); return 'carets=' + cs.length })()`)
    await sleep(600)
    const menu = await ev(`JSON.stringify([...document.querySelectorAll('.as-side-menu-item')].map((i) => i.textContent.trim()))`)
    console.log('[更多菜单]', openMenu, menu)
    const hasApvItem = JSON.parse(menu || '[]').includes('审批通过')
    chk('② 提交人自己看得到「审批通过」入口(菜单里)', hasApvItem, menu)

    if (hasApvItem) {
      await ev(`(() => { const i = [...document.querySelectorAll('.as-side-menu-item')].find((x) => x.textContent.trim() === '审批通过'); if (i) i.click(); return 'clicked' })()`)
      await sleep(1500)
      const toast = await ev(`(document.querySelector('.el-message') ? document.querySelector('.el-message').textContent.trim() : '')`)
      const dialog = await ev(`(document.querySelector('.el-dialog__title') ? document.querySelector('.el-dialog__title').textContent.trim() : '')`)
      console.log('[点击后] toast=' + toast + ' | 弹窗=' + (dialog || '(无)'))
      chk('③ 给出「编制与审批分离」人话原因', String(toast).includes('编制与审批分离'), toast)
      chk('④ 不再弹出「选取二级审核人」（修前就是这个弹窗）', dialog !== '选取二级审核人', dialog || '(无)')
    }
  } finally {
    edge.kill()
    await sleep(300)
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  console.log(fails ? `\n${fails} 项未通过` : '\n全部通过')
  if (fails) process.exitCode = 1
}
main().catch((e) => { console.error('探针异常:', e); process.exit(2) })
