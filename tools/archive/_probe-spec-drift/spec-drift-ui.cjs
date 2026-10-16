/**
 * UI 取证:引用单上的「规格书已变动」黄条 + 责任人看得到「弃审」(2026-10-16 用户口径)
 *
 * 前置:先跑 tools/archive/_probe-spec-drift/spec-drift.cjs 造出那条链
 *   (产品信息表 PI-* → 规格书 SD-* 申请修改中 → 成型工艺清单 MP-* 已归档,责任人 chaishanyin)。
 * 本探针以**责任人 chaishanyin** 登录,打开那张 MP 单,断言:
 *   ① 出现黄条(文案含"本单引用的规格书 … 正在修改"),且给出"弃审→重新引用"的下一步;
 *   ② 侧栏看得到「弃审」按钮(改动前:无审批权 → 根本没有这个入口);
 *   ③ 落一张截图当证据。
 *
 * 用法:node tools/archive/_probe-spec-drift/spec-drift-ui.cjs [URL] [单据编号]
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const URL_ = (process.argv[2] || 'http://127.0.0.1:8090/').replace(/\/$/, '')
const DOC = process.argv[3] || 'MP-2026-10-0021'
const USER = 'chaishanyin'
const PORT = 9404
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const chk = (name, ok, detail) => {
  console.log(`  ${ok ? '\u2713' : '\u2717'} ${name}${detail === undefined ? '' : '  → ' + String(detail).slice(0, 240)}`)
  if (!ok) fails++
}

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-'))
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
      body: JSON.stringify({ userName: USER, password: '123456', factory: 'YJ_TEST' }),
    })
    const lj = await lr.json()
    console.log(`[登录 ${USER}]`, lr.status, 'code=' + lj?.code, lj?.data?.user?.realName)
    if (!lj?.data?.token) throw new Error('登录失败: ' + JSON.stringify(lj).slice(0, 160))

    await send('Page.navigate', { url: URL_ + '/#/login' }); await sleep(2500)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user || {}))});
localStorage.setItem('mes_login_date','2026-10-16'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
    await send('Page.navigate', { url: `${URL_}/#/panelx/list/RD_MOLD_PROC?docNo=${DOC}` }); await sleep(10000)

    const dump = await ev(`JSON.stringify((() => {
      const txt = (el) => (el.textContent || '').replace(/\\s+/g, ' ').trim()
      const banner = document.querySelector('.spec-drift-banner')
      const side = document.querySelector('.approval-side')
      return {
        banner: banner ? txt(banner) : '',
        hasUnaudit: side ? [...side.querySelectorAll('.as-side-btn, .as-side-menu-item')].some((b) => txt(b) === '弃审') : false,
        bodyHead: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 200),
        // ⚠ 单据号要在**全文**里找:黄条会把前 200 字占满(第一版只看前 200 字,误判"单据没打开")
        bodyAll: (document.body.innerText || '').replace(/\\s+/g, ' '),
      }
    })())`)
    console.log('[页面]', dump)
    const d = JSON.parse(dump)
    chk('① 打开的是成型工艺清单且黄条属于目标单据',
      String(d.bodyAll).includes('成型工艺清单') && String(d.banner).includes('SD-2026-10-0014'),
      `面板=成型工艺清单:${String(d.bodyAll).includes('成型工艺清单')} 黄条含 SD-2026-10-0014:${String(d.banner).includes('SD-2026-10-0014')}`)
    chk('② 出现「规格书已变动」黄条', !!d.banner && /规格书/.test(d.banner), d.banner || '(无黄条)')
    chk('③ 黄条给出下一步(弃审 → 重新引用)', /弃审/.test(d.banner) && /重新|带入/.test(d.banner), d.banner)
    chk('④ 责任人看得到「弃审」入口', d.hasUnaudit === true, `hasUnaudit=${d.hasUnaudit}`)

    const shot = (await send('Page.captureScreenshot', { format: 'png' })).result?.data
    if (shot) {
      const out = path.join(__dirname, 'spec-drift-banner.png')
      fs.writeFileSync(out, Buffer.from(shot, 'base64'))
      console.log('  截图 →', out)
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
