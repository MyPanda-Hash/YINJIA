/* 调试:登录后看左栏到底是展开还是折叠、二级菜单为何为空 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const API = 'http://127.0.0.1:8090/api'
const APP = 'http://127.0.0.1:5173'
const PORT = 9393
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login.data.token

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dbg-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1000',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
try {
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pending = new Map()
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const raw = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i = 0; i < 80; i++) { await sleep(300); if (await raw('document.readyState') === 'complete') { await sleep(2500); return } } }
  await send('Page.enable'); await send('Runtime.enable')
  await nav(`${APP}/#/login`); await sleep(2000)
  console.log('reload 前 localStorage:', await raw(`JSON.stringify({c: localStorage.getItem('mes_collapsed'), m: localStorage.getItem('mes_menu_mode')})`))
  await raw(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
             localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))});
             localStorage.setItem('mes_collapsed', '0');
             localStorage.setItem('mes_menu_mode', 'accordion'); 'ok'`)
  console.log('写入后:', await raw(`JSON.stringify({c: localStorage.getItem('mes_collapsed'), m: localStorage.getItem('mes_menu_mode')})`))
  await nav('about:blank')
  await nav(`${APP}/#/dashboard`); await sleep(5000)
  console.log('左栏 class:', await raw(`document.querySelector('.leftnav')?.className`))
  console.log('一级:', await raw(`JSON.stringify([...document.querySelectorAll('.leftnav .nav-group')].map(e=>e.innerText.trim()))`))
  // 点智能供应链
  await raw(`(() => { const g=[...document.querySelectorAll('.leftnav .nav-group')].find(e=>e.innerText.trim()==='智能供应链'); g?.dispatchEvent(new MouseEvent('click',{bubbles:true})); return !!g })()`)
  await sleep(1200)
  console.log('点后 二级:', await raw(`JSON.stringify([...document.querySelectorAll('.leftnav .nav-module')].map(e=>e.innerText.trim()))`))
  console.log('nav-modules 容器数:', await raw(`document.querySelectorAll('.leftnav .nav-modules').length`))
  console.log('左栏 HTML 片段:', String(await raw(`document.querySelector('.leftnav')?.outerHTML.slice(0, 600)`)))
} finally { edge.kill() }
