/**
 * 开发态验证:5173(vite dev)有没有把页面顶成 `<vite-error-overlay>` 错误遮罩。
 *
 * 背景(2026-10-16):用户改用 5173 后立刻看到
 *   [plugin:vite:vue] <KeepAlive> expects exactly one child component.  PortalLayout.vue:11:15
 * 根因:dev 模式编译器要求 keep-alive **恰好一个子元素**(compiler-core postTransformElement:
 *   `node.children.length > 1` 即报 X_KEEP_ALIVE_INVALID_CHILDREN),而那段注释也算一个 child;
 *   生产构建只警告 ⇒ 构建期看不出来。修法 = 把注释挪到 keep-alive 外面。
 *
 * 用法:node check-overlay.cjs [URL]      # 默认 http://127.0.0.1:5173/
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const URL_ = process.argv[2] || 'http://127.0.0.1:5173/'
const PORT = 9399
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const chk = (name, ok, detail) => {
  console.log(`  ${ok ? '\u2713' : '\u2717'} ${name}${detail === undefined ? '' : '  → ' + String(detail).slice(0, 300)}`)
  if (!ok) fails++
}

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ovl-'))
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
    let id = 0; const pend = new Map(); const errs = []
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return }
      if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails?.exception?.description || '').slice(0, 160))
    }
    const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
    const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable')
    const failed = []
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.method === 'Network.responseReceived' && m.params.response.status >= 500) failed.push(`${m.params.response.status} ${m.params.response.url}`)
    })
    await send('Network.enable')
    // 先登录(顺带验 /api 代理:5173 → 8090),再把 token 塞进 localStorage,
    // 否则新 profile 停在登录页 —— `.portal` 永远不出现,② 会误判。
    const lr = await fetch(URL_.replace(/\/$/, '') + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
    })
    const lj = await lr.json()
    console.log('[登录(经 5173 代理)]', lr.status, 'code=' + lj?.code)
    if (!lj?.data?.token) throw new Error('登录失败(代理或后端不通): ' + JSON.stringify(lj).slice(0, 160))
    await send('Page.navigate', { url: URL_ }); await sleep(2500)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user || {}))});
localStorage.setItem('mes_login_date','2026-10-16'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
    await send('Page.navigate', { url: URL_ }); await sleep(9000)
    const probe = await ev(`JSON.stringify({
      overlay: !!document.querySelector('vite-error-overlay'),
      overlayText: (document.querySelector('vite-error-overlay') ? document.querySelector('vite-error-overlay').shadowRoot.textContent.slice(0,160) : ''),
      portal: !!document.querySelector('.portal'),
      nav: !!document.querySelector('.portal-body'),
    })`)
    console.log('[页面]', probe)
    const p = JSON.parse(probe)
    chk('① 没有 vite 错误遮罩', p.overlay === false, p.overlayText || '(无)')
    chk('② 门户布局正常渲染(.portal + .portal-body)', p.portal && p.nav, `portal=${p.portal} nav=${p.nav}`)
    chk('③ 没有 5xx 模块请求', failed.length === 0, failed.slice(0, 3).join(' | '))
    chk('④ 无 JS 运行时异常', errs.length === 0, errs.slice(0, 3).join(' | '))
  } finally {
    edge.kill()
    await sleep(300)
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  console.log(fails ? `\n${fails} 项未通过` : '\n全部通过')
  if (fails) process.exitCode = 1
}
main().catch((e) => { console.error('探针异常:', e); process.exit(2) })
