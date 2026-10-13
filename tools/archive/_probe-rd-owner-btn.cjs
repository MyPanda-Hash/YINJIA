/**
 * _probe-rd-owner-btn.cjs —— 以 cp 身份打开立项申请单,看侧栏「分发对接人 / 确认责任人」两个按钮的
 * 实际文案、是否置灰、title 提示(2026-10-13)。
 *
 * 为什么单独一支:接口侧 rdFlow/state 已给出 canConfirmOwner=true,但要回答用户「没有权限进行确认责任人
 * 签核」是怎么表现出来的,必须看**界面**上按钮到底在不在、可不可点 —— 接口能点 ≠ 界面上给了入口。
 *
 * 账套:YJ_TEST(登录后硬断言);目标页默认 8090(用户实际在看的地址),可用 YINJIA_PAGE 覆盖。
 * 只读:不点任何会写库的按钮。
 * 用法:node tools/archive/_probe-rd-owner-btn.cjs [单号...]
 */
'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.env.YINJIA_PAGE || 'http://127.0.0.1:8090'
const FACTORY = 'YJ_TEST'
const USER = process.env.PROBE_USER || 'cp'
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
/** ⚠ 端口必须避开 Windows 保留段(8408-8607/8708-9007/9181-9380/9481-9680/41900-42147/50000-50059),
 *  否则 Edge 报 bind() 0x271D(WSAEACCES) 且 DevToolsActivePort 永不生成 → /json/new 直接 fetch failed */
const PORT = 9778
const SHOTS = path.join(__dirname, '_shots')

const DOCS = process.argv.slice(2)
const TARGETS = DOCS.length ? DOCS : ['LXA-2026-10-0057', 'LXA-2026-10-0056']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function login(userName) {
  const r = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, password: '123456', factory: FACTORY }),
  })).json()
  if (!r?.data?.token) throw new Error(`${userName} 登录失败:${JSON.stringify(r).slice(0, 200)}`)
  if (r.data.user?.factory !== FACTORY) throw new Error(`令牌账套不是 ${FACTORY}(实为 ${r.data.user?.factory})`)
  return r.data
}

async function main() {
  console.log(`\n=== 立项申请侧栏「分发对接人 / 确认责任人」按钮实况(身份=${USER} / 页 ${BASE}) ===`)
  const me = await login(USER)
  console.log(`  登录 ${USER} → ${me.user.realName} isAdmin=${me.user.isAdmin} factory=${me.user.factory}(已断言)`)

  fs.mkdirSync(SHOTS, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-owner-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1760,1400', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  let ws = null
  try {
    await sleep(3000)
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const nav = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 90; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } }
    }
    const shot = async (tag) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (!r.result?.data) return null
      const f = path.join(SHOTS, `rd-owner-btn-${tag}.png`)
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }
    const dismissInit = () => ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0})
      for (var i=0;i<ds.length;i++){ var t=(ds[i].innerText||'')
        if (t.indexOf('初始化')>=0){ var bs=[].slice.call(ds[i].querySelectorAll('button,span,a'))
          for (var j=0;j<bs.length;j++){ if((bs[j].textContent||'').trim()==='下次再说'){ bs[j].click(); return 'dismissed' } } } }
      return 'none' })()`)

    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1400, deviceScaleFactor: 1, mobile: false })
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(me.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(me.user))}); 'ok'`)
    await nav('about:blank')

    for (const no of TARGETS) {
      console.log(`\n──────── ${no} ────────`)
      await nav(`${BASE}/#/panelx/list/RD_APPROVAL?docNo=${encodeURIComponent(no)}`)
      await sleep(2200)
      await dismissInit()
      await sleep(1000)

      const state = await ev(`fetch('/api/px/rdFlow/state?docNo=${encodeURIComponent(no)}',{headers:{Authorization:'Bearer '+localStorage.getItem('mes_token')}}).then(r=>r.json()).then(j=>JSON.stringify(j.data))`)
      console.log(`  接口 rdFlow/state = ${state}`)

      const btns = await ev(`(function(){ return [].slice.call(document.querySelectorAll('.as-side-btn')).filter(function(b){return b.offsetParent})
        .map(function(b){ return { text:(b.textContent||'').trim(), disabled:b.classList.contains('disabled'), title:b.getAttribute('title')||'' } }) })()`)
      const all = Array.isArray(btns) ? btns : []
      console.log(`  侧栏 ${all.length} 个可见按钮: ${all.map((b) => (b.disabled ? '[' + b.text + '·灰]' : b.text)).join(' | ')}`)
      for (const key of ['分发对接人', '确认责任人', '项目定级']) {
        const hit = all.find((b) => b.text.indexOf(key) >= 0)
        if (hit) console.log(`  ${hit.disabled ? '置灰' : '可点'}  ${key}${hit.title ? '  title=' + hit.title : ''}`)
        else console.log(`  不存在  ${key}(侧栏没有这个按钮)`)
      }
      const chip = await ev(`(function(){ var e=document.querySelector('.doc-chip, .side-doc-no, .as-side-docno'); return e?(e.textContent||'').trim():'' })()`)
      console.log(`  当前打开的单据条 = ${JSON.stringify(chip)}`)
      const f = await shot(no)
      console.log(`  截图:${f}`)
    }
  } finally {
    if (ws) try { ws.close() } catch { /* ignore */ }
    edge.kill()
  }
  console.log('\n完成(只读,未点任何写库按钮)')
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
