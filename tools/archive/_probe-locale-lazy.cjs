/* 语言包按需加载验证:①默认中文 ②localStorage=en 启动即英文 ③运行时切日文 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('ws')
const PORT = 9351
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(process.env.TEMP || os.tmpdir(), 'yj-locale-verify')
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (n, c, e = '') => { (c ? (pass++, console.log('  ok -', n)) : (fail++, console.log('  FAIL -', n, e))) }
async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-lc-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,900', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(1500); return } } }
    const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); if (r?.result?.data) fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64')) }
    const bodyText = async () => evaluate('document.body.innerText')
    await send('Page.enable'); await send('Runtime.enable')

    // ① 默认中文
    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.clear(); 'ok'`)
    await navigate('about:blank')
    await navigate('http://localhost:5173/#/login')
    let t = await bodyText()
    // 语言包 chunk 命名:dev=/src/i18n/locales/<loc>.js;prod=/assets/<loc>-<hash>.js
    const loadedLocale = (loc) => evaluate(`performance.getEntriesByType('resource').some(r => new RegExp('/(locales/${loc}\\\\.js|${loc}-[A-Za-z0-9_-]+\\\\.js)$').test(r.name.split('?')[0]))`)
    ok('默认界面为中文(进入系统)', t.includes('进入系统'), t.slice(0, 80))
    const noForeignChunk = await evaluate(`!performance.getEntriesByType('resource').some(r => new RegExp('/(locales/(ja|ko|ru|th|vi|fr|de|es|zh-TW|en)\\\\.js|(ja|ko|ru|th|vi|fr|de|es|zh-TW)-[A-Za-z0-9_-]+\\\\.js)$').test(r.name.split('?')[0]))`)
    ok('中文首屏未加载任何外语包', noForeignChunk)

    // ② 启动恢复英文(localStorage=en → 刷新即英文,不闪中文)
    await evaluate(`localStorage.setItem('mes_locale','en'); 'ok'`)
    await navigate('about:blank')
    await navigate('http://localhost:5173/#/login')
    await sleep(1200)
    t = await bodyText()
    ok('启动即英文(Enter System)', /Enter System|Sign in|Log in/i.test(t), t.slice(0, 80))
    const enLoaded = await loadedLocale('en')
    ok('en 包已按需加载', enLoaded)
    await shot('1-en-boot.png')

    // ③ 运行时切日文(顶栏/登录页语言下拉 → 日本語)
    const switched = await evaluate(`(async () => {
      // 语言下拉:登录页右上角 el-select(或含当前语言名的控件)
      const sel = document.querySelector('.el-select') || document.querySelector('.lang-select') || Array.from(document.querySelectorAll('*')).find(e => e.childElementCount === 0 && /English|简体中文/.test(e.textContent) && e.closest('select, .el-select, [class*=lang], [class*=locale]'))
      if (!sel) return 'no-select'
      sel.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise(r => setTimeout(r, 800))
      const opt = Array.from(document.querySelectorAll('.el-select-dropdown__item, li, option')).find(e => /日本語|日本/.test(e.textContent))
      if (!opt) return 'no-option:' + document.querySelectorAll('.el-select-dropdown__item').length
      opt.click()
      await new Promise(r => setTimeout(r, 1800))
      return 'clicked'
    })()`)
    console.log('切换操作:', switched)
    await sleep(1000)
    t = await bodyText()
    const jaLoaded = await loadedLocale('ja')
    ok('ja 包已按需加载', jaLoaded)
    ok('界面切为日文(含假名/汉字日文词)', /システム|ログイン|製造|実行/.test(t), t.slice(0, 80))
    await shot('2-ja-switch.png')
    console.log(`\n结果: pass=${pass} fail=${fail}  OUT: ${OUT}`)
    process.exit(fail ? 1 : 0)
  } finally { edge.kill() }
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
