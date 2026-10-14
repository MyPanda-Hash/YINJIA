/**
 * 一次性探针(2026-10-15)之三:修好之后,**在真实浏览器里**复核「切页签保留未保存填写」。
 *
 * 与 _q-tabclick.mjs 的差别:切回来之后**长时间轮询**(最长 15s)——修复是在 await load()
 * 之后才把暂存放回那一行,固定 1.5s 采样会误判成"还丢着"。
 *
 * 口径:UI 传 4173(npx vite preview,dist = 本次构建,接口代理到 8090);
 *      对照传 8090(内嵌旧前端)。除 UI 地址外两条完全同源。
 * 用法: node tools/archive/_probe-tabswitch-keep/_q-fix-verify.mjs [uiBase] [repeat]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const API = process.env.PROBE_API || 'http://127.0.0.1:8090'
const UI = process.argv[2] || 'http://127.0.0.1:4173'
const ROUNDS = Number(process.argv[3] || 2)
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const MARK = 'PROBEKEEP-FIX'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const j = (v) => JSON.stringify(v)

const A = 'RD_MOLD_PROC'   // 成型工艺清单(草稿 MP-2026-10-0001,第 2 个内部页签有可编辑格)
const B = 'RD_ASM_PROC'    // 组装工艺清单(草稿 AP-2026-10-0001)
const TAB_A = '成型工艺清单'
const TAB_B = '组装工艺清单'

const lg = await (await fetch(API + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
const token = lg?.data?.token
if (!token) { console.error('[FATAL] 登录失败'); process.exit(1) }

const profile = mkdtempSync(join(tmpdir(), 'edge-fixverify-'))
const port = 9345
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
  status: document.querySelector('.doc-status')?.innerText?.trim() || '',
  mark: [...document.querySelectorAll('input')].filter(i => i.value === ${j(MARK)}).length,
  dlg: [...document.querySelectorAll('.el-dialog, .el-message-box')].map(d => d.innerText.replace(/\\s+/g,' ').slice(0,60)),
}))()`)
const clickTab = (title) => ev(`(() => {
  const t = [...document.querySelectorAll('.tabsbar .tab')].find(x => x.innerText.trim().indexOf(${j(title)}) >= 0);
  if (!t) return { ok: false, have: [...document.querySelectorAll('.tabsbar .tab')].map(x => x.innerText.trim()) };
  t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  return { ok: true };
})()`)
const typeMark = () => ev(`(() => {
  const all = [...document.querySelectorAll('.rsp-sheet input')]
    .filter(i => i instanceof HTMLInputElement && i.type !== 'hidden' && !i.disabled && !i.readOnly && i.offsetParent !== null);
  if (!all.length) return { ok: false };
  const el = all[0];
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${j(MARK)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return { ok: true, v: el.value, holder: (el.closest('td') || el.parentElement)?.className || '' };
})()`)
const gotoHash = async (code, ms = 6000) => { await ev(`location.hash = '#/panelx/list/${code}'; 'ok'`); await sleep(ms) }

await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: UI + '/#/login' })
await sleep(3500)
await ev(`localStorage.setItem('mes_token', ${j(token)});localStorage.setItem('mes_user', ${j(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_factory', ${j(JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))});'ok'`)
await send('Page.reload', { ignoreCache: true })
await sleep(8000)
console.log(`[target] UI=${UI} API=${API}`)

// 先把 B 开成一个页签,再把 A 打开(两页签都在,才能用真页签点击互切)
await gotoHash(B, 6000)
await gotoHash(A, 6000)
console.log('[tabs]', j(await ev(`[...document.querySelectorAll('.tabsbar .tab')].map(t => t.innerText.trim())`)))

let allPass = true
for (let round = 1; round <= ROUNDS; round++) {
  console.log(`\n──────── 第 ${round} 轮 ────────`)
  // 点内部第 2 个页签(可编辑格最多的一页),写标记
  await ev(`document.querySelectorAll('.rsp-page-tab')[1].click(); 'ok'`); await sleep(1800)
  console.log('[type]', j(await typeMark()))
  await sleep(1500)
  const before = await snap()
  console.log('[before-switch]', j(before))

  // 点 B 页签 → 等
  console.log('[click B]', j(await clickTab(TAB_B))); await sleep(4000)
  console.log('[at B]', j(await snap()))

  // 点回 A 页签 → 长时间轮询
  console.log('[click A]', j(await clickTab(TAB_A)))
  let last = null
  for (let i = 0; i < 30; i++) {
    await sleep(500)
    last = await snap()
    if (last.mark > 0) { console.log(`  +${(i + 1) * 500}ms mark=${last.mark} ← 暂存已放回`); break }
    if (i % 4 === 3) console.log(`  +${(i + 1) * 500}ms mark=${last.mark} panel=${last.panel}`)
  }
  // 放回后:再点内部第 2 页签,确认那一格的值就是原标记
  await ev(`document.querySelectorAll('.rsp-page-tab')[1]?.click(); 'ok'`); await sleep(1500)
  const after = await snap()
  const visible = await ev(`[...document.querySelectorAll('input')].filter(i => i.value === ${j(MARK)} && i.offsetParent !== null).length`)
  const ok = after.mark > 0 && visible > 0
  if (!ok) allPass = false
  console.log(`[after-return] mark=${after.mark} 可见=${visible} panel=${after.panel} → ${ok ? '[PASS] 未保存填写保留' : '[FAIL] 仍未保存'}`)
}
console.log(`\n总结:${allPass ? '[PASS] 切页签保留未保存填写' : '[FAIL] 仍会丢'}(UI=${UI})`)
try { edge.kill() } catch { /* ignore */ }
