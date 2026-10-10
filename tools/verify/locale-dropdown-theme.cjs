/* 验证语言下拉弹层在 亮色 / 暗色 两套主题下的可读性。
 * 关键:必须在下拉「打开状态」下截图,否则弹层不在画面里(前两轮探针的坑)。
 * 用法: node tools/verify/locale-dropdown-theme.cjs
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('ws')
const PORT = 9355
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })
  const login = await loginRes.json()
  const token = login.data.token
  const user = login.data.user

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-locale-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
    '--window-size=1280,900',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const newRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
    const tab = await newRes.json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      const d = r.result
      if (d?.exceptionDetails) return 'EXCEPTION: ' + (d.exceptionDetails.exception?.description || JSON.stringify(d.exceptionDetails))
      return d?.result?.value
    }
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 80; i++) { await sleep(250); if (await evaluate('document.readyState') === 'complete') { await sleep(1500); return } }
    }
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      if (r.result?.data) {
        const p = path.join(OUT, name)
        fs.writeFileSync(p, Buffer.from(r.result.data, 'base64'))
        return p
      }
      return null
    }

    await send('Page.enable'); await send('Runtime.enable')
    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); localStorage.setItem('mes_dark','0'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)

    // 打开语言下拉(保持开启),返回弹层几何 + 计算样式
    // 关键:必须用 CDP 派发真实鼠标事件,element.click() 不会触发 EP 的 popper 展开
    const openAndProbe = `(async () => {
      const trig = document.querySelector('.locale-switch')
      if (!trig) return { err: 'no .locale-switch' }
      const r = trig.getBoundingClientRect()
      window.__probeClick = { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
      return { trigRect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
    })()`

    const readPopper = `(async () => {
      const pop = document.querySelector('.locale-glass-popper')
      if (!pop) return { err: 'no .locale-glass-popper' }
      const cs = getComputedStyle(pop)
      const rect = pop.getBoundingClientRect()
      const item = pop.querySelector('.el-dropdown-menu__item')
      const span = pop.querySelector('.locale-option')
      const active = pop.querySelector('.locale-option.locale-active')
      return {
        htmlDark: document.documentElement.classList.contains('dark'),
        visible: cs.display !== 'none' && cs.visibility !== 'hidden' && rect.width > 0,
        popRect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
        popBg: cs.backgroundColor, popBd: cs.borderColor, popperClass: pop.className,
        itemColor: item ? getComputedStyle(item).color : null,
        spanColor: span ? getComputedStyle(span).color : null,
        activeColor: active ? getComputedStyle(active).color : null,
        itemCount: pop.querySelectorAll('.el-dropdown-menu__item').length,
        text: (pop.textContent || '').trim().replace(/\\s+/g, ' ')
      }
    })()`

    // 用真实鼠标事件点开语言下拉,并等 popper 可见
    const openLocale = async () => {
      const rect = await evaluate(openAndProbe)
      if (!rect || rect.err) return rect
      const cx = Math.round(rect.trigRect.x + rect.trigRect.w / 2)
      const cy = Math.round(rect.trigRect.y + rect.trigRect.h / 2)
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 })
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 })
      for (let i = 0; i < 20; i++) {
        await sleep(200)
        const vis = await evaluate(`(() => { const p = document.querySelector('.locale-glass-popper'); if (!p) return false; const c = getComputedStyle(p); const r = p.getBoundingClientRect(); return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 0 })()`)
        if (vis) break
      }
      return await evaluate(readPopper)
    }

    const clipShot = async (rect, name) => {
      if (!rect || !rect.w) return null
      const c = await send('Page.captureScreenshot', { format: 'png',
        clip: { x: Math.max(0, rect.x - 40), y: Math.max(0, rect.y - 30), width: rect.w + 80, height: rect.h + 70, scale: 2 } })
      if (!c.result?.data) return null
      const p = path.join(OUT, name)
      fs.writeFileSync(p, Buffer.from(c.result.data, 'base64'))
      return p
    }


    const report = {}

    // ---- 亮色(冷启动) ----
    await navigate('about:blank')
    await navigate('http://localhost:5173/#/dashboard')
    await sleep(4000)
    report.lightCold = await openLocale()
    await shot('_locale-light-cold.png')
    report.lightColdCrop = await clipShot(report.lightCold?.popRect, '_locale-light-crop.png')

    // ---- 切暗 → 冷启动暗色 ----
    await evaluate(`localStorage.setItem('mes_dark','1'); 'ok'`)
    await navigate('about:blank')
    await navigate('http://localhost:5173/#/dashboard')
    await sleep(4000)
    report.darkCold = await openLocale()
    await shot('_locale-dark-cold.png')
    report.darkColdCrop = await clipShot(report.darkCold?.popRect, '_locale-dark-crop.png')

    // ---- 切回亮色(热切换,复现用户路径) ----
    await evaluate(`localStorage.setItem('mes_dark','0'); 'ok'`)
    await navigate('about:blank')
    await navigate('http://localhost:5173/#/dashboard')
    await sleep(4000)
    report.lightAfterRoundTrip = await openLocale()
    await shot('_locale-after-light.png')
    report.lightAfterCrop = await clipShot(report.lightAfterRoundTrip?.popRect, '_locale-after-light-crop.png')

    // ---- 登录页 el-select 弹层 ----
    await evaluate(`localStorage.removeItem('mes_token'); 'ok'`)
    await navigate('about:blank')
    await navigate('http://localhost:5173/#/login')
    await sleep(2500)
    report.loginPage = await evaluate(`(async () => {
      const sel = document.querySelector('.login-locale .el-select')
      if (!sel) return { err: 'no login locale select' }
      const r = sel.getBoundingClientRect()
      return { selRect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
    })()`)
    if (report.loginPage && report.loginPage.selRect) {
      const r = report.loginPage.selRect
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h / 2), button: 'left', clickCount: 1 })
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h / 2), button: 'left', clickCount: 1 })
      for (let i = 0; i < 20; i++) {
        await sleep(200)
        const vis = await evaluate(`(() => { const p = document.querySelector('.locale-select-popper'); if (!p) return false; const c = getComputedStyle(p); const r2 = p.getBoundingClientRect(); return c.display !== 'none' && r2.width > 0 })()`)
        if (vis) break
      }
      report.loginPage = { ...report.loginPage, ...(await evaluate(`(async () => {
        const pop = document.querySelector('.locale-select-popper')
        if (!pop) return { err2: 'no .locale-select-popper' }
        const cs = getComputedStyle(pop); const rect = pop.getBoundingClientRect()
        const item = pop.querySelector('.el-select-dropdown__item')
        return { htmlDark: document.documentElement.classList.contains('dark'),
          visible: cs.display !== 'none' && rect.width > 0,
          popRect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
          popBg: cs.backgroundColor, popperClass: pop.className,
          itemColor: item ? getComputedStyle(item).color : null,
          text: (pop.textContent || '').trim().replace(/\\s+/g, ' ') }
      })()`)) }
      await shot('_locale-login.png')
      report.loginCrop = await clipShot(report.loginPage.popRect, '_locale-login-crop.png')
    }

    console.log(JSON.stringify(report, null, 1))
  } finally {
    try { edge.kill() } catch {}
  }
}
main().catch(e => { console.error('FAIL', e); process.exit(1) })
