#!/usr/bin/env node
/** 排障:在指定 CDP 端口上找「保存」按钮的真实 DOM(标签/类名/可见性) */
const PORT = process.argv[2] || '9225'
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = list.find((t) => t.type === 'page' && /^http/.test(t.url))
if (!page) { console.log('no http page:', JSON.stringify(list.map((t) => t.url))); process.exit(0) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let id = 0
const pending = new Map()
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.result?.value
const out = await ev(`(()=>{
  const hits=[...document.querySelectorAll('*')].filter(e=>e.children.length===0 && (e.textContent||'').trim()==='保存');
  return hits.map(e=>({
    tag:e.tagName, cls:e.className, parentCls:e.parentElement?.className, gpCls:e.parentElement?.parentElement?.className,
    visible:e.offsetParent!==null, title:e.getAttribute('title')||''
  }));
})()`)
console.log(JSON.stringify(out, null, 2))
console.log('tb-main count =', await ev(`document.querySelectorAll('.tb-main').length`))
console.log('toolbars =', await ev(`[...document.querySelectorAll('[class*=toolbar],[class*=tb-]')].map(e=>e.className).slice(0,15).join(' | ')`))
process.exit(0)
