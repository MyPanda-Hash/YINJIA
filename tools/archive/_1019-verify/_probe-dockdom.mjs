import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
const PORT = 9365, EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
const FE = "http://localhost:5173"
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const login = await (await fetch("http://127.0.0.1:8090/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userName: "admin", password: "123456" }) })).json()
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "yj-dbg-"))
const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" })
await sleep(2600)
const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json()
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pending = new Map()
ws.addEventListener("message", ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
await send("Page.enable"); await send("Runtime.enable")
await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })
await send("Page.navigate", { url: FE + "/#/login" }); await sleep(2000)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
await send("Page.navigate", { url: "about:blank" }); await sleep(400)
await send("Page.navigate", { url: FE + "/#/panelx/list/STOCK_DETAIL" }); await sleep(6000)
const info = await ev(`(() => {
  const all = [...document.querySelectorAll('*')].filter(e => !e.children.length && /恒亿仓/.test(e.textContent||''))
  const first = all[0]
  const chain = []
  let p = first
  for (let i = 0; i < 6 && p; i++) { chain.push(p.tagName + '.' + String(p.className).slice(0, 46)); p = p.parentElement }
  const cbs = [...document.querySelectorAll('input[type=checkbox]')].slice(0, 8)
  return { n: all.length, chain, cbCount: document.querySelectorAll('input[type=checkbox]').length,
           cbParents: cbs.map(c => String(c.parentElement?.className).slice(0, 50)) }
})()`)
console.log(JSON.stringify(info, null, 1).slice(0, 1800))
edge.kill()
