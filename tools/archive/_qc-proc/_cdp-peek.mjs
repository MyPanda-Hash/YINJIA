#!/usr/bin/env node
/** 读一眼某个 CDP 端口上 **应用页**(http 那个)的状态(排障用):node _cdp-peek.mjs 9225 */
const PORT = process.argv[2] || '9225'
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = list.find((t) => t.type === 'page' && /^http/.test(t.url))
if (!page) { console.log('no http page:', JSON.stringify(list.map((t) => t.url))); process.exit(0) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let id = 0
const pending = new Map()
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
}
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.result?.value
console.log('url =', page.url)
console.log('hash =', await ev('location.hash'))
console.log('docNo =', await ev(`((document.body.innerText||'').match(/ZC-\\d{4}-\\d{2}-\\d{4}/)||[null])[0]`))
console.log('groups =', await ev(`[...document.querySelectorAll('.qr-grid thead th.c-group')].map(th=>th.textContent.trim().replace(/\\s+/g,' ')).join(' | ')`))
console.log('cells =', await ev(`[...document.querySelectorAll('.qr-grid thead .qr-cells-n')].map(e=>e.textContent.trim()).join(',')`))
console.log('toast =', await ev(`[...document.querySelectorAll('.el-message')].map(e=>e.textContent.trim()).join(' | ')`))
console.log('msgbox =', await ev(`[...document.querySelectorAll('.el-message-box')].map(e=>e.textContent.trim().slice(0,120)).join(' | ')`))
console.log('buttons =', await ev(`[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(Boolean).slice(0,25).join(' | ')`))
process.exit(0)
