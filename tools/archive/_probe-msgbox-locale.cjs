/**
 * _probe-msgbox-locale.cjs — 验证「Element Plus 命令式组件跟随系统语言」的根因修复
 *
 * 修复前:ElMessageBox 渲染在组件树之外,拿不到 <el-config-provider> 的 locale,
 *   只认模块级 globalConfig —— 而 app.use(ElementPlus) 没传 options ⇒ 恒为默认中文
 *   ⇒ 英文界面下弹窗按钮仍是「确定 / 取消」。
 * 修复后:App.vue 在 setup 里把当前语言写进**全局**配置,命令式组件随之切换。
 *
 * 验证方式:通过 Vue 应用实例调用 ElMessageBox(EP 安装器把它挂在
 * app.config.globalProperties.$confirm / $msgbox 上),它走的就是**默认按钮**那条路径,
 * 不需要去点某个具体业务按钮 ⇒ 可稳定复现,且不产生任何数据改动。
 *
 * 用法:node --experimental-websocket tools/archive/_probe-msgbox-locale.cjs
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const FRONT = 'http://127.0.0.1:8090'
const API = 'http://127.0.0.1:8090/api'
const PORT = 9364
const OUT = path.join(process.env.TEMP, 'yinjia-org-shots')
const CANDS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
]
const EDGE = CANDS.find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')) }
}

async function run(locale, expect) {
  const login = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data.token
  const user = login.data.user

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'msgbox-'))
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' })
  try {
    let target = null
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(300)
      try { const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = list.find((t) => t.type === 'page') } catch {}
    }
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let id = 0; const pend = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
    const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
    const ev = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
      if (r.result?.exceptionDetails) return 'EXC:' + (r.result.exceptionDetails.exception?.description || '').slice(0, 200)
      return r.result?.result?.value
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })

    await send('Page.navigate', { url: FRONT + '/#/login' })
    await sleep(1500)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_locale', ${JSON.stringify(locale)}); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(500)
    await send('Page.navigate', { url: FRONT + '/#/dashboard' }); await sleep(4000)
    await ev(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 'x' })()`)
    await sleep(800)

    // 用应用实例调用命令式 MessageBox(不传按钮文案 ⇒ 走 Element Plus 默认 locale 那条路)
    const fired = await ev(`(() => {
      const app = document.querySelector('#app') && document.querySelector('#app').__vue_app__
      const gp = app && app.config && app.config.globalProperties
      if (!gp || !gp.$confirm) return 'no-globalProperties:' + (gp ? Object.keys(gp).filter(k=>k.startsWith('$')).join(',') : 'none')
      gp.$confirm('probe', 'probe', { type: 'warning' }).catch(() => {})
      return 'fired'
    })()`)
    await sleep(900)
    const box = await ev(`(() => {
      const b = document.querySelector('.el-message-box')
      if (!b) return { visible: false }
      return { visible: true, btns: [...b.querySelectorAll('.el-message-box__btns button')].map((x) => (x.innerText || '').trim()) }
    })()`)
    console.log('  [' + locale + '] fired=' + fired + ' 弹窗=' + JSON.stringify(box))
    ok(locale + ': 命令式 MessageBox 弹出', box.visible === true, JSON.stringify(box))
    ok(locale + ': 默认按钮 = ' + expect.join(' / '), expect.every((t) => (box.btns || []).includes(t)), JSON.stringify(box.btns))
    const s = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
    fs.mkdirSync(OUT, { recursive: true })
    const f = path.join(OUT, 'msgbox-default-buttons-' + locale + '.png')
    if (s.result?.data) fs.writeFileSync(f, Buffer.from(s.result.data, 'base64'))
    console.log('  截图 → ' + f)
    await ev(`(() => { const b=[...document.querySelectorAll('.el-message-box__btns button')][0]; if(b) b.click(); return 'x' })()`)
    ws.close()
  } finally { edge.kill() }
}

async function main() {
  if (!EDGE) throw new Error('找不到 Edge/Chrome')
  console.log('== Element Plus 命令式组件语言跟随(根因修复验证) ==\n')
  await run('zh-CN', ['取消', '确定'])
  await run('en', ['Cancel', 'OK'])
  await run('ja', ['キャンセル', 'OK'])
  console.log('\n== 结果:' + pass + ' 通过 / ' + fail + ' 失败 ==')
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error('FAIL: ' + e.message); process.exit(1) })
