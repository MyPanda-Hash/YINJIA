/**
 * _probe-5173-blank.mjs — 5173 白屏排查(2026-10-07):dev server 到底渲染出什么
 * 采集:① 页面标题/#app 是否有内容 ② 控制台 error 与未捕获异常 ③ 失败的请求 ④ 截图
 * 用法:node tools/archive/_probe-5173-blank.mjs [--route "#/prod/plan/workOrderList"]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d }
const SITE = arg('site', 'http://localhost:5173')
const ROUTE = arg('route', '')
const PORT = 9414
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PROFILE = path.resolve('D:/workspace/yinjia/.probe-edge-profile-5173')
const SHOT = path.resolve('tools/archive/_probe-5173-blank.png')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

fs.mkdirSync(PROFILE, { recursive: true })
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1600,1000', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore' })
let version = null
for (let i = 0; i < 40 && !version; i++) { await sleep(500); try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json() } catch {} }
if (!version) { console.error('[FATAL] Edge 未就绪'); edge.kill(); process.exit(1) }

const errors = []
const failed = []
try {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const tab = targets.find((t) => t.type === 'page' && t.url === 'about:blank') || targets.find((t) => t.type === 'page')
  const socket = new WebSocket(tab.webSocketDebuggerUrl)
  let seq = 0; const pending = new Map()
  await new Promise((res, rej) => { socket.addEventListener('open', () => res()); socket.addEventListener('error', () => rej(new Error('ws fail'))) })
  socket.addEventListener('message', (ev) => {
    let m; try { m = JSON.parse(ev.data) } catch { return }
    if (m?.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
    if (m?.method === 'Runtime.exceptionThrown') errors.push('EXC ' + String(m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text).slice(0, 400))
    if (m?.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') errors.push('CONSOLE ' + (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400))
    if (m?.method === 'Network.loadingFailed') failed.push(`${m.params?.type} ${m.params?.errorText}`)
    if (m?.method === 'Network.responseReceived' && m.params?.response?.status >= 400) failed.push(`${m.params.response.status} ${m.params.response.url}`)
  })
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); socket.send(JSON.stringify({ id, method, params })) })
  const ev = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value

  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

  // 先取 token 注入(模拟「已登录的长开页签」),再看目标路由渲染成什么样
  let token = ''
  let user = null
  try {
    const login = await (await fetch('http://127.0.0.1:8090/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ userName: 'admin', password: '123456' }),
    })).json()
    token = login?.data?.token || ''
    user = login?.data?.user || null
  } catch (e) { console.log('[warn] 取 token 失败:', e.message) }
  if (token) {
    await send('Page.navigate', { url: SITE + '/#/login' })
    await sleep(2000)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' })
    await sleep(400)
  }

  await send('Page.navigate', { url: SITE + '/' + ROUTE })
  await sleep(9000)

  const state = await ev(`(function(){
    const app = document.getElementById('app');
    return JSON.stringify({
      title: document.title,
      url: location.href,
      appChildren: app ? app.children.length : -1,
      appTextLen: app ? (app.innerText || '').trim().length : -1,
      appTextHead: app ? (app.innerText || '').trim().slice(0, 160) : '',
      hasLogin: !!document.querySelector('.login-page, .login-wrap, form .el-input__inner'),
      bodyBg: getComputedStyle(document.body).backgroundColor,
    });
  })()`)
  console.log('[页面状态]', state)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  if (shot?.result?.data) { fs.writeFileSync(SHOT, Buffer.from(shot.result.data, 'base64')); console.log('[截图]', SHOT) }
  console.log('[控制台错误]', errors.length, errors.slice(0, 8))
  console.log('[失败请求]', failed.length, failed.slice(0, 8))
  const st = JSON.parse(state || '{}')
  const ok = (st.appTextLen || 0) > 20 && errors.length === 0
  console.log(`\n=== 结论:5173 ${ok ? '渲染正常' : '渲染异常'} (文本长度=${st.appTextLen}, 控制台错误=${errors.length}, 失败请求=${failed.length}) ===`)
} finally {
  try { edge.kill() } catch {}
  await sleep(300)
  try { fs.rmSync(PROFILE, { recursive: true, force: true }) } catch {}
}
