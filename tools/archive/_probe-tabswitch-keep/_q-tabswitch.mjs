/**
 * 一次性探针 v2(2026-10-15):「切换页签时未保存的填写内容为什么会自动消失」。
 *
 * v1 教训:用的是 RD_SPEC_DOC 的**已归档**单 → 只读、没有可编辑输入框,写不进标记。
 * v2 改用测试账套里真实存在的**草稿**文书面板:RD_MOLD_PROC(MP-2026-10-0001)↔ RD_ASM_PROC。
 *
 * 断言顺序:
 *   ① 在 A 面板的可见输入框写入唯一标记 → 确认 v-model 收下(读回 DOM);
 *   ② 面板**内部页签**来回切(第1页↔第2页)→ 标记应保留(证伪"内部页签是元凶");
 *   ③ 切到 B 面板路由(= 点顶部页签的动作)→ 再切回 A → 标记还在不在(证真/证伪跨面板页签丢数据)。
 * 全程**不点保存**;出现守卫弹窗只记录文案并点「取消」。
 *
 * 用法: node tools/archive/_probe-tabswitch-keep/_q-tabswitch.mjs [apiBase] [uiBase]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const API = process.argv[2] || 'http://127.0.0.1:8090'
const UI = process.argv[3] || 'http://127.0.0.1:8090'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const MARK = 'PROBEKEEP-2026'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const A = 'RD_MOLD_PROC'   // 草稿 MP-2026-10-0001(页签:修订记录/成型工艺清单/成型配方)
const B = 'RD_ASM_PROC'    // 草稿 AP-2026-10-0001(页签:修订记录/组装BOM表/组装工艺清单)
// ⚠ 根元素同时挂 .record-sheet 与 .rsp-sheet 两个类 ⇒ 选择器必须写成 '... input',
//   写成 '.record-sheet, .rsp-sheet input' 会把根 DIV 自己也算进来(踩过:Illegal invocation)。
const SHEET = '.rsp-sheet'
const INP = `.rsp-sheet input`

async function login() {
  const r = await fetch(API + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })
  const j = await r.json()
  return j?.data?.token ? { token: j.data.token, user: j.data.user } : null
}
const lg = await login()
if (!lg) { console.error('[FATAL] 登录失败'); process.exit(1) }
console.log(`[login] dbFactory=${lg.user?.factory}`)

const profile = mkdtempSync(join(tmpdir(), 'edge-tabkeep-'))
const port = 9341
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
if (!ws) { console.error('[FATAL] 连不上 Edge CDP'); process.exit(1) }
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => {
  const m = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  const d = m.result?.exceptionDetails
  if (d) return { __err: d.exception?.description || d.text || 'eval error' }
  return m.result?.result?.value
}
const j = (v) => JSON.stringify(v)

await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: UI + '/#/login' })
await sleep(3500)
await ev(`localStorage.setItem('mes_token', ${j(lg.token)});`
  + `localStorage.setItem('mes_user', ${j(JSON.stringify(lg.user))});`
  + `localStorage.setItem('mes_factory', ${j(JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))}); 'ok'`)
await send('Page.reload', { ignoreCache: true })
await sleep(8000)
console.log('[boot] token 已注入并重载')

async function goto(code, waitSel) {
  await ev(`location.hash = '#/panelx/list/${code}'; 'ok'`)
  for (let i = 0; i < 40; i++) {
    if (await ev(`!!document.querySelector(${j(waitSel)})`)) break
    await sleep(400)
  }
  await sleep(2000)
  return await ev(`location.hash + ' | ' + (document.querySelector('.as-side-title span')?.innerText || '')`)
}
const dialogs = () => ev(`[...document.querySelectorAll('.el-message-box, .el-dialog, .el-overlay')]
  .map(b => b.innerText.replace(/\\s+/g,' ').trim().slice(0,160)).filter(Boolean)`)
const state = () => ev(`(() => ({
  hash: location.hash,
  status: document.querySelector('.doc-status')?.innerText?.trim() || '',
  pageTabs: [...document.querySelectorAll('.rsp-page-tab')].map(t => t.innerText.trim()),
  activeTab: [...document.querySelectorAll('.rsp-page-tab.active')].map(t => t.innerText.trim())[0] || '',
  editableInputs: [...document.querySelectorAll(${j(INP)})].filter(i => i instanceof HTMLInputElement && i.type !== 'hidden' && !i.disabled && !i.readOnly && i.offsetParent !== null).length,
  markCount: [...document.querySelectorAll('input')].filter(i => i.value === ${j(MARK)}).length,
  markVisible: [...document.querySelectorAll('input')].filter(i => i.value === ${j(MARK)} && i.offsetParent !== null).length,
}))()`)

const typeMark = () => ev(`(() => {
  const MARK = ${j(MARK)};
  const all = [...document.querySelectorAll(${j(INP)})]
    .filter(i => i instanceof HTMLInputElement && i.type !== 'hidden' && !i.disabled && !i.readOnly && i.offsetParent !== null);
  if (!all.length) return { ok: false, reason: '无可见可编辑输入框' };
  const el = all[0];
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, MARK);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.setAttribute('data-probe', '0');
  return { ok: true, cls: el.className, value: el.value, candidates: all.length,
           holder: (el.closest('td') || el.parentElement)?.className || '' };
})()`)

/** 点到第 i 个面板页签(内部页签),返回点后的活动页签名 */
const clickPage = async (i) => {
  const r = await ev(`(() => {
    const tabs = [...document.querySelectorAll('.rsp-page-tab')];
    if (tabs.length <= ${i}) return { ok: false, n: tabs.length };
    tabs[${i}].click(); return { ok: true, n: tabs.length };
  })()`)
  await sleep(1500)
  return r
}
/** 找到"可编辑输入框最多"的内部页签下标(= 真正能录数据的页) */
const pageWithInputs = async () => {
  const n = await ev(`document.querySelectorAll('.rsp-page-tab').length`)
  let best = 0, bestN = -1
  for (let i = 0; i < n; i++) {
    await clickPage(i)
    const c = (await state()).editableInputs
    if (c > bestN) { bestN = c; best = i }
  }
  return { idx: best, count: bestN }
}

console.log('\n=== ① 打开草稿文书面板 ' + A + ' ===')
console.log('[nav]', await goto(A, SHEET))
console.log('[state]', j(await state()))

console.log('\n=== ② 找到可录数据的内部页签并写入标记 ' + MARK + ' ===')
const pick = await pageWithInputs()
console.log('[page-pick] 输入框最多的页签 idx=' + pick.idx + ' 可编辑输入框=' + pick.count)
await clickPage(pick.idx)
console.log('[type]', j(await typeMark()))
await sleep(1500)
console.log('[verify] state =', j(await state()))

console.log('\n=== ③ 面板**内部页签**来回切(本页 ↔ 其它页)===')
const other = pick.idx === 0 ? 1 : 0
await clickPage(other)
console.log('[state@other]', j(await state()))
await clickPage(pick.idx)
console.log('[state@return]', j(await state()))

console.log('\n=== ④ 切到另一个面板页签 ' + B + '(= 点顶部页签的动作)===')
console.log('[nav]', await goto(B, SHEET))
console.log('[dialog?]', j(await dialogs()))
console.log('[state@B]', j(await state()))

console.log('\n=== ⑤ 切回 ' + A + ' 并点回同一个内部页签 ===')
console.log('[nav]', await goto(A, SHEET))
await sleep(2000)
console.log('[dialog?]', j(await dialogs()))
await clickPage(pick.idx)
const back = await state()
console.log('[state@back]', j(back))
console.log(`\n结论①(路由切面板):跨面板切页签后标记 ${back.markCount > 0 ? '【保留】' : '【已丢失】'}`)

// ── ⑥ 用**真·顶部页签点击**再验一遍(与用户动作逐字一致)──────────────
console.log('\n=== ⑥ 重新写标记,然后点顶部页签切走再切回 ===')
await clickPage(pick.idx)
console.log('[retype]', j(await typeMark()))
await sleep(1500)
console.log('[tabs]', j(await ev(`[...document.querySelectorAll('.tabsbar .tab')].map(t => t.innerText.trim())`)))
console.log('[mark]', (await state()).markCount)
const clickTabByText = async (title) => {
  const r = await ev(`(() => {
    const t = [...document.querySelectorAll('.tabsbar .tab')].find(x => x.innerText.trim().indexOf(${j(title)}) >= 0);
    if (!t) return { ok: false, have: [...document.querySelectorAll('.tabsbar .tab')].map(x => x.innerText.trim()) };
    t.querySelector('span').click(); return { ok: true, hashBefore: location.hash };
  })()`)
  await sleep(3000)
  return { ...r, hashAfter: await ev(`location.hash`), panel: await ev(`document.querySelector('.as-side-title span')?.innerText || ''`) }
}
console.log('[click tab B]', j(await clickTabByText(B === 'RD_MOLD_PROC' ? '组装工艺清单' : '成型工艺清单')))
console.log('[dialog?]', j(await dialogs()))
console.log('[click tab A]', j(await clickTabByText('成型工艺清单')))
await sleep(2000)
await clickPage(pick.idx)
const afterTabClick = await state()
console.log('[state@afterTabClick]', j(afterTabClick))
console.log(`\n结论②(点顶部页签):标记 ${afterTabClick.markCount > 0 ? '【保留】' : '【已丢失】'}`)

try { edge.kill() } catch { /* ignore */ }
