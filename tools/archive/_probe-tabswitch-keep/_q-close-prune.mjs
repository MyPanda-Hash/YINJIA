/**
 * 一次性探针(2026-10-15)之四:修好之后,「× 掉页签 = 该丢 / 没×掉 = 保留」两端都要成立。
 *
 * 关键技巧:关**非当前**页签不会导航(closeAndGo 只对当前页签导航),因此不会撞上
 * 「未保存提示」弹窗(那是下一批的任务) —— 于是能干净地单独验证 × 的清理语义。
 *
 * 步骤:A 上填写标记 → 切到 B 页签(= 离开 A,A 的填写被暂存)→ 切回 A:标记应【在】;
 *       再切到 B(A 的暂存重建)→ 点 A 页签上的 × (A 非当前,不导航、不弹窗)→
 *       重新打开 A:标记应【已丢弃】。
 * 用法: node tools/archive/_probe-tabswitch-keep/_q-close-prune.mjs [uiBase]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const API = process.env.PROBE_API || 'http://127.0.0.1:8090'
const UI = process.argv[2] || 'http://127.0.0.1:4173'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const MARK = 'PROBEKEEP-CLOSE'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const j = (v) => JSON.stringify(v)
const A = 'RD_MOLD_PROC', B = 'RD_ASM_PROC'
const TAB_A = '成型工艺清单', TAB_B = '组装工艺清单'
const PAGE2 = `.rsp-page-tab` // 第 2 个内部页签(下标 1)才有可编辑格

const lg = await (await fetch(API + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
const token = lg?.data?.token
if (!token) { console.error('[FATAL] 登录失败'); process.exit(1) }

const profile = mkdtempSync(join(tmpdir(), 'edge-closeprune-'))
const port = 9349
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
const markCount = () => ev(`[...document.querySelectorAll('input')].filter(i => i.value === ${j(MARK)}).length`)
const tabsNow = () => ev(`[...document.querySelectorAll('.tabsbar .tab')].map(t => t.innerText.trim())`)
const dialogs = () => ev(`[...document.querySelectorAll('.el-dialog')].map(d => d.innerText.replace(/\\s+/g,' ').slice(0,50))`)
const clickTab = (title) => ev(`(() => {
  const t = [...document.querySelectorAll('.tabsbar .tab')].find(x => x.innerText.trim().indexOf(${j(title)}) >= 0);
  if (!t) return { ok: false, have: [...document.querySelectorAll('.tabsbar .tab')].map(x => x.innerText.trim()) };
  t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); return { ok: true };
})()`)
const closeTab = (title) => ev(`(() => {
  const t = [...document.querySelectorAll('.tabsbar .tab')].find(x => x.innerText.trim().indexOf(${j(title)}) >= 0);
  if (!t) return { ok: false, have: [...document.querySelectorAll('.tabsbar .tab')].map(x => x.innerText.trim()) };
  const c = t.querySelector('.close');
  if (!c) return { ok: false, reason: 'no .close' };
  c.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); return { ok: true };
})()`)
const openHash = async (code, ms = 7000) => { await ev(`location.hash = '#/panelx/list/${code}'; 'ok'`); await sleep(ms) }
const openPage2 = async () => { await ev(`document.querySelectorAll(${j(PAGE2)})[1]?.click(); 'ok'`); await sleep(1800) }

await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: UI + '/#/login' })
await sleep(3500)
await ev(`localStorage.setItem('mes_token', ${j(token)});localStorage.setItem('mes_user', ${j(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_factory', ${j(JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))});'ok'`)
await send('Page.reload', { ignoreCache: true })
await sleep(8000)
await openHash(B, 7000)   // 先把 B 开成页签
await openHash(A, 7000)   // 再到 A
console.log(`[target] UI=${UI}`)
console.log('[tabs]', j(await tabsNow()))

await openPage2()
console.log('[type]', j(await ev(`(() => {
  const all = [...document.querySelectorAll('.rsp-sheet input')].filter(i => i instanceof HTMLInputElement && i.type !== 'hidden' && !i.disabled && !i.readOnly && i.offsetParent !== null);
  if (!all.length) return { ok: false };
  const el = all[0];
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${j(MARK)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return { ok: true, v: el.value };
})()`)))
await sleep(1500)
console.log('[A 已填写] mark =', await markCount())

console.log('\n① 切到 B(离开 A,A 的填写应被暂存)')
console.log('[click B]', j(await clickTab(TAB_B))); await sleep(4000)
console.log('   B 上 mark =', await markCount(), '| dlg =', j(await dialogs()))

console.log('\n② 切回 A → 填写应仍在')
console.log('[click A]', j(await clickTab(TAB_A)))
let kept = 0
for (let i = 0; i < 24; i++) { await sleep(500); kept = await markCount(); if (kept > 0) break }
await openPage2()
kept = await markCount()
console.log('   A 上 mark =', kept, kept > 0 ? '[PASS] 没×掉 ⇒ 保留' : '[FAIL] 没×掉却丢了')

console.log('\n③ 再切到 B(A 的暂存重建),然后 × 掉 **非当前** 的 A 页签')
console.log('[click B]', j(await clickTab(TAB_B))); await sleep(4000)
console.log('[× A]', j(await closeTab(TAB_A))); await sleep(2500)
console.log('   tabs =', j(await tabsNow()), '| hash =', await ev(`location.hash`), '| dlg =', j(await dialogs()))

console.log('\n④ 重新打开 A(从菜单/hash 重开) → 填写应已丢弃')
await openHash(A, 8000)
await openPage2()
const after = await markCount()
console.log('   A 上 mark =', after, after === 0 ? '[PASS] ×掉 ⇒ 已丢' : '[FAIL] ×掉后仍复活')
console.log(`\n总结:没×掉=${kept > 0 ? '保留✔' : '丢✘'} / ×掉后=${after === 0 ? '丢✔' : '复活✘'}(UI=${UI})`)

try { edge.kill() } catch { /* ignore */ }
