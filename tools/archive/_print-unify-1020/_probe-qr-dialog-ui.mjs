#!/usr/bin/env node
/**
 * QrLabelDialog(二维码标签弹窗)端到端探针(2026-10-20)
 *
 * 目的:**真的在界面里点一遍**改过的打印入口 —— 把 QrLabelDialog 挂到页面上(标签数据用 ref,
 *   与 PanelxList 的 `qrLabels` 同形),点弹窗里的「打印」,断言走的是页面内打印层、不再开子窗口。
 *
 * 为什么挂组件而不是点面板按钮:MANU_ORDER/条码三面板要先「查询」出单据、条码面板的「打印标签」
 *   还会向服务端落打印留痕 —— 本探针要做到**零写库**,所以只挂被改的这个组件(它只有一个按钮、无外部取数)。
 *   仍遵守 §5.5 L7:改过的界面必须真在浏览器里点一次,不能只靠 `vite build` 绿。
 *
 * 安全:不写库(纯前端构造标签 + window.print 被 stub,不会弹打印对话框)。
 * 用法: node tools/archive/_print-unify-1020/_probe-qr-dialog-ui.mjs [http://127.0.0.1:5173] [账号] [口令]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const URL_ = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '')
const USER = process.argv[3] || 'admin'
const PASS = process.argv[4] || '123456'
const PORT = 9461 // 避开 Windows 保留段(§5.5 E17)
const PROFILE = path.join(os.tmpdir(), 'edge-qrdlg-probe-' + PORT)
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p))
const OUT_DIR = path.dirname(fileURLToPath(import.meta.url))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`)
}

const lr = await fetch(`${URL_}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: USER, password: PASS }), signal: AbortSignal.timeout(20000),
}).then((r) => r.json()).catch((e) => ({ message: String(e) }))
const token = lr?.data?.token
const userJson = JSON.stringify(lr?.data?.user || {})
check('登录 ' + URL_, !!token)
if (!token) process.exit(1)

const edge = spawn(EDGE, ['--headless=new', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-background-networking', '--disable-popup-blocking',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--window-size=1600,1000', 'about:blank'],
{ stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
let edgeErr = ''
edge.stderr?.on('data', (d) => { edgeErr += String(d) })

let ws = null
let id = 0
const pending = new Map()
const send = (method, params = {}) => new Promise((res, rej) => {
  const msg = { id: ++id, method, params }
  pending.set(msg.id, { res, rej })
  ws.send(JSON.stringify(msg))
})
const evalIn = async (expression, awaitPromise = false) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'evaluate failed')
  return r.result?.value
}
const pages = async () => (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === 'page')
async function clickAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
}

try {
  let up = false
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) { up = true; break } } catch {}
    await sleep(250)
  }
  if (!up) throw new Error('Edge 调试端口没起来。stderr: ' + edgeErr.slice(0, 300))

  const tgt = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  ws = new WebSocket(tgt.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  const consoleErrors = []
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id)
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result)
    }
    if (m.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(m.params?.exceptionDetails?.exception?.description || 'exception')
    }
  }
  await send('Runtime.enable')
  await send('Page.enable')

  await send('Page.navigate', { url: URL_ + '/?probe=1' })
  await sleep(2500)
  await evalIn(`localStorage.setItem('mes_token', ${JSON.stringify(token)});`
    + `localStorage.setItem('mes_user', ${JSON.stringify(userJson)});'ok'`)
  await send('Page.navigate', { url: URL_ + '/#/panelx/list/INV' })
  await sleep(7000)
  await evalIn(`window.__p = { printed: 0 }; window.print = () => { window.__p.printed++ }; 'ok'`)
  const before = (await pages()).length

  // ① 挂载弹窗(标签数据用 ref ⇒ 与 PanelxList 的 qrLabels 同形,renderQr 写回 qr 时才会触发重渲染)
  const mount = await evalIn(`(async () => {
    try {
      const { createApp, h, ref } = await import('/node_modules/.vite/deps/vue.js')
      const Comp = (await import('/src/core/views/QrLabelDialog.vue')).default
      const el = document.createElement('div'); el.id = 'probe-qr-dlg'; document.body.appendChild(el)
      const labels = ref([
        { code: 'YJ-TS-004', name: '滤芯', lot: 'L20261020', qty: 8, unit: '支', doc: 'GD-PROBE-0001',
          warehouse: '', supplier: '探针供应商', bin: '', qr: '' },
        { code: 'YJ-TS-005', name: '炭棒', lot: '', qty: 3, unit: '支', doc: 'GD-PROBE-0001', qr: '' },
      ])
      const app = createApp({ render: () => h(Comp, { modelValue: true, title: '探针二维码标签', labels: labels.value }) })
      app.mount(el)
      window.__probeApp = app
      return 'MOUNTED'
    } catch (e) { return 'ERR:' + e.message }
  })()`, true)
  check('QrLabelDialog 可挂载', mount === 'MOUNTED', String(mount))
  await sleep(1800)

  const dlg = await evalIn(`(() => {
    const d = document.querySelector('.qr-label-dlg')
    const cards = document.querySelectorAll('.qr-label-dlg .qr-label-card')
    const imgs = [...document.querySelectorAll('.qr-label-dlg .qr-label-img')]
    return {
      open: !!d && !!d.offsetParent,
      cards: cards.length,
      qrImgs: imgs.length,
      png: imgs.every((i) => /^data:image\\/png/.test(i.getAttribute('src') || '')),
      btn: [...document.querySelectorAll('.qr-label-dlg button')].map((b) => (b.innerText || '').trim()).filter(Boolean),
    }
  })()`)
  check('弹窗已弹出且两行标签各出二维码图', dlg?.open === true && dlg?.cards === 2 && dlg?.qrImgs === 2 && dlg?.png === true, JSON.stringify(dlg))
  check('此时还没有打印层(点打印之前)', (await evalIn(`!document.getElementById('yj-print-host')`)) === true)

  // ② 真鼠标点弹窗里的「打印」
  const btnRect = await evalIn(`(() => {
    const b = [...document.querySelectorAll('.qr-label-dlg button')].find((x) => (x.innerText || '').trim() === '打印')
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  check('弹窗内「打印」按钮存在', !!btnRect, JSON.stringify(btnRect))
  if (btnRect) { await clickAt(btnRect.x, btnRect.y); await sleep(700) }

  const afterClick = await evalIn(`(() => {
    const host = document.getElementById('yj-print-host')
    const html = host ? host.innerHTML : ''
    return {
      host: !!host,
      cards: (html.match(/class="card"/g) || []).length,
      png: html.includes('data:image/png'),
      hasQrPage: html.includes('@page'),
      lot: html.includes('L20261020'),
      title: document.title,
      printed: window.__p.printed,
      screenHidden: !!host && getComputedStyle(host).display === 'none',
    }
  })()`)
  check('点「打印」→ 走页面内打印层(window.print 1 次,不开子窗口)', afterClick?.printed === 1 && afterClick?.host === true, JSON.stringify(afterClick))
  check('打印层里是 2 张标签卡 + 二维码 + LOT 段', afterClick?.cards === 2 && afterClick?.png === true && afterClick?.lot === true, JSON.stringify(afterClick))
  check('打印层屏幕上不可见(不闪屏) + 标题=标签名', afterClick?.screenHidden === true && afterClick?.title === '探针二维码标签', JSON.stringify({ h: afterClick?.screenHidden, t: afterClick?.title }))

  // ③ 版式截图(print 媒体)
  await send('Emulation.setEmulatedMedia', { media: 'print' }).catch(() => {})
  await sleep(400)
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }).catch(() => null)
  await send('Emulation.setEmulatedMedia', { media: 'screen' }).catch(() => {})
  if (shot?.data) {
    try {
      fs.writeFileSync(path.join(OUT_DIR, '_out-qrdlg-print.png'), Buffer.from(shot.data, 'base64'))
      console.log('  ↳ 版式截图已存:' + path.join(OUT_DIR, '_out-qrdlg-print.png'))
    } catch { /* 忽略 */ }
  }

  // ④ 打完清理 + 没开新窗口
  await evalIn(`window.dispatchEvent(new Event('afterprint')); 'ok'`)
  await sleep(300)
  check('afterprint 后打印层摘掉', (await evalIn(`!document.getElementById('yj-print-host')`)) === true)
  const after = (await pages()).length
  check('全程没有开新窗口', after === before, `pages ${before} → ${after}`)
  check('全程无未捕获异常', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))
  await evalIn(`try { window.__probeApp.unmount(); document.getElementById('probe-qr-dlg')?.remove() } catch (e) {}; 'ok'`)
} catch (e) {
  check('探针执行', false, e.message)
} finally {
  try { ws?.close() } catch {}
  try { edge.kill() } catch {}
  await sleep(500)
  try { fs.rmSync(PROFILE, { recursive: true, force: true }) } catch {}
  const pass = results.filter((r) => r.ok).length
  console.log(`\n=== ${pass}/${results.length} PASS ===`)
  process.exit(pass === results.length ? 0 : 1)
}
