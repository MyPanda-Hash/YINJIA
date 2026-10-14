/**
 * 一次性探针(2026-10-15)之二:**真·点顶部页签**的行为隔离测试。
 * 问题:上一版点页签后 hash 没变 —— 到底(a)根本没导航,还是(b)被"未保存"守卫拦下了?
 * 做法:同一会话里跑两轮「点组装工艺清单页签」——第一轮不填任何东西,第二轮先填未保存的标记;
 *       每 300ms 采样一次 hash 与弹窗,看清规则。
 * 用法: node tools/archive/_probe-tabswitch-keep/_q-tabclick.mjs
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const API = process.env.PROBE_API || 'http://127.0.0.1:8090'
const UI = process.argv[2] || 'http://127.0.0.1:8090'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const MARK = 'PROBEKEEP-CLICK'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const j = (v) => JSON.stringify(v)

const A = 'RD_MOLD_PROC', B = 'RD_ASM_PROC'

const lg = await (await fetch(API + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
const token = lg?.data?.token
if (!token) { console.error('[FATAL] 登录失败'); process.exit(1) }

const profile = mkdtempSync(join(tmpdir(), 'edge-tabclick-'))
const port = 9343
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank'], { stdio: 'ignore' })
let ws, msgId = 0
const pending = new Map()
for (let i = 0; i < 60; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) {
      ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
      ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
      break
    }
  } catch { /* retry */ }
  await sleep(500)
}
if (!ws) { console.error('[FATAL] CDP 连不上'); process.exit(1) }
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => {
  const m = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (m.result?.exceptionDetails) return { __err: m.result.exceptionDetails.exception?.description || m.result.exceptionDetails.text }
  return m.result?.result?.value
}
const snap = () => ev(`(() => ({
  hash: location.hash,
  panel: document.querySelector('.as-side-title span')?.innerText || '',
  dlg: [...document.querySelectorAll('.el-dialog, .el-message-box')].map(d => d.innerText.replace(/\\s+/g,' ').slice(0,80)),
  mark: [...document.querySelectorAll('input')].filter(i => i.value === ${j(MARK)}).length,
  pages: document.querySelectorAll('.rsp-page-tab').length,
}))()`)

await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: UI + '/#/login' })
await sleep(3500)
await ev(`localStorage.setItem('mes_token', ${j(token)});localStorage.setItem('mes_user', ${j(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_factory', ${j(JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))});'ok'`)
await send('Page.reload', { ignoreCache: true })
await sleep(8000)

// 打开 A,并把 组装工艺清单(B)也开成一个页签(经 hash,PortalLayout 会按菜单建页签)
await ev(`location.hash = '#/panelx/list/${B}'; 'ok'`); await sleep(6000)
await ev(`location.hash = '#/panelx/list/${A}'; 'ok'`); await sleep(6000)
console.log('[init]', j(await snap()))
console.log('[tabs]', j(await ev(`[...document.querySelectorAll('.tabsbar .tab')].map(t => t.innerText.trim())`)))

/** 点顶部页签(直接点 .tab 容器)并每 300ms 采样 6s */
async function clickAndWatch(title, label) {
  console.log(`\n=== ${label}:点顶部页签「${title}」 ===`)
  const before = await snap()
  const r = await ev(`(() => {
    const t = [...document.querySelectorAll('.tabsbar .tab')].find(x => x.innerText.trim().indexOf(${j(title)}) >= 0);
    if (!t) return { ok: false, have: [...document.querySelectorAll('.tabsbar .tab')].map(x => x.innerText.trim()) };
    t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return { ok: true, cls: t.className };
  })()`)
  const seq = []
  for (let i = 0; i < 20; i++) {
    await sleep(300)
    const s = await snap()
    seq.push(`${s.hash} | panel=${s.panel} | mark=${s.mark} | dlg=${JSON.stringify(s.dlg)}`)
    if (i > 3 && s.hash.includes(title === '组装工艺清单' ? B : A)) break
  }
  console.log('[click]', j(r), '| before:', before.hash)
  for (const [i, line] of seq.entries()) console.log(`  +${(i + 1) * 300}ms  ${line}`)
  return await snap()
}

// 轮次 1:干净态(没有任何未保存修改)
await clickAndWatch('组装工艺清单', '轮次1 · 干净态')
await clickAndWatch('成型工艺清单', '轮次1 · 切回')

// 轮次 2:先在 A 的第 2 个内部页签填标记(未保存),再点 B 页签
await ev(`document.querySelectorAll('.rsp-page-tab')[1].click(); 'ok'`); await sleep(1500)
console.log('\n[type]', j(await ev(`(() => {
  const MARK = ${j(MARK)};
  const all = [...document.querySelectorAll('.rsp-sheet input')].filter(i => i instanceof HTMLInputElement && i.type !== 'hidden' && !i.disabled && !i.readOnly && i.offsetParent !== null);
  if (!all.length) return { ok: false };
  const el = all[0];
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, MARK);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return { ok: true, v: el.value };
})()`)))
await sleep(1200)
await clickAndWatch('组装工艺清单', '轮次2 · 有未保存标记')
await clickAndWatch('成型工艺清单', '轮次2 · 切回(先点第2内部页签再数标记)')
console.log('\n[final]', j(await snap()))

try { edge.kill() } catch { /* ignore */ }
