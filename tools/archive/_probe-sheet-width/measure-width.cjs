/**
 * 取证:立项申请(RD_APPROVAL) / 项目实施计划(RD_PLAN) **纸张实际宽度**是多少。
 *
 * 用户口径(2026-10-16):「立项申请和项目实施计划的宽度是多少现在」——问的是活体页面里
 * 那张纸(纸面网格)现在的像素宽,用来跟 RD_CHANGE 收窄后的 1242px 对比。
 *
 * 为什么必须实测:这两张单走 DocSheet.vue 的 `.approval-sheet`,CSS 写的是 `width:940px;
 * max-width:100%`,而外层 `.approval-layout :deep(.approval-sheet){flex:1;min-width:0}`
 * ⇒ **宽度是弹性的**(容器够宽就撑开、窄窗就被压),源码里的 940 不是最终显示值。
 *
 * 用法:node measure-width.cjs [URL]      # 默认 http://127.0.0.1:5173/
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const URL_ = (process.argv[2] || 'http://127.0.0.1:5173/').replace(/\/$/, '')
const PORT = 9401
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const MEASURE = `JSON.stringify((() => {
  const q = (s) => document.querySelector(s)
  const box = (el) => el ? { w: Math.round(el.getBoundingClientRect().width), css: getComputedStyle(el).width } : null
  const sheet = q('.approval-sheet') || q('.progress-sheet')
  const rows = sheet ? [...sheet.querySelectorAll('.as-row')].slice(0, 3).map((r) => Math.round(r.getBoundingClientRect().width)) : []
  return {
    route: location.pathname + location.search,
    win: window.innerWidth,
    layout: box(q('.approval-layout')),
    sidebar: box(q('.approval-side')),
    sheet: box(sheet),
    sheetClass: sheet ? sheet.className : null,
    bodyEl: box(sheet && (sheet.querySelector('.as-body') || sheet.querySelector('.as-table'))),
    table: box(q('.as-table')),
    remark: box(q('.as-remark')),
    signW: box(q('.as-sign-cell')),
    firstRowWidths: rows,
    status: (q('.doc-status') || {}).textContent || '',
    no: (q('.as-no, .as-docno') || {}).textContent || '',
  }
})())`

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-'))
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' })
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
      body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
    })
    const lj = await lr.json()
    console.log('[登录]', lr.status, 'code=' + lj?.code)
    if (!lj?.data?.token) throw new Error('登录失败: ' + JSON.stringify(lj).slice(0, 160))

    await send('Page.navigate', { url: URL_ + '/#/login' }); await sleep(2500)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user || {}))});
localStorage.setItem('mes_login_date','2026-10-16'); 'ok'`)
    // ⚠ 注完 token 必须**整页重载**(about:blank 中转)——同文档 hash 跳转不重跑启动逻辑,
    //   路由守卫会把页面弹回登录页(本节是实测踩坑)。
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
    const DIAG = `JSON.stringify({
      text: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 300),
      appKids: [...(document.querySelector('#app')?.children || [])].map((e) => e.tagName + '.' + e.className).slice(0, 6),
      loginPage: !!document.querySelector('input[type=password]'),
      errs: window.__errs || [],
    })`

    // ⚠ 路由是 **hash 模式**(`/#/panelx/list/<面板码>`);写成路径式 URL 会落到门户首页
    await send('Page.navigate', { url: URL_ + '/#/panelx/list/RD_APPROVAL' }); await sleep(9000)
    console.log('\n[诊断]', await ev(DIAG))

    // 纸张宽度是**弹性**的(容器宽 − 176px 侧栏)⇒ 只报一个数没意义,按常见窗口宽各测一遍
    for (const w of [1280, 1440, 1600, 1920]) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: 1000, deviceScaleFactor: 1, mobile: false })
      await sleep(700)
      console.log(`  ${w}px 窗口  立项申请 `, await ev(MEASURE))
    }
    await send('Emulation.clearDeviceMetricsOverride')
    await sleep(500)

    await send('Page.navigate', { url: URL_ + '/#/panelx/list/RD_PLAN' }); await sleep(9000)
    for (const w of [1280, 1440, 1600, 1920]) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: 1000, deviceScaleFactor: 1, mobile: false })
      await sleep(700)
      console.log(`  ${w}px 窗口  实施计划 `, await ev(MEASURE))
    }
  } finally {
    edge.kill()
    await sleep(300)
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('探针异常:', e); process.exit(2) })
