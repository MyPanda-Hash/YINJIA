/**
 * 一次性探针(2026-10-31):「批量生单」+ 统一生单对话框的**界面截图存证**。
 *
 * 验证用户那两句口径:
 *   ① 「在生单下多写一个批量生单的功能」——生单组右侧出现 ▼,下拉里有「批量生单」;
 *   ② 「在左侧边栏中增加勾选出来,勾选多个采购单后打开一个新的界面为勾选的各个单据的明细行,再进行选择」
 *      ——左栏每行一个勾选框 + 「已勾选 N 张」;勾两张后点批量生单,对话框里**每张单一段明细**,
 *      每行勾选框 + 「本次数量」可填;
 *   ③ 「生单也要变成可以勾选的和选择数量的(现在只有采购订单的生单做了特殊处理)」——
 *      采购订单的「生单」仍是原分批送料对话框(材料码隔离行/超送比例),而
 *      **销售订单「生成销售出库单」、生产工单「生成产成品入库单」改走统一对话框**;
 *   ④ 多语言:对话框切英文后不出现中文文案。
 *
 * 产物: tools/archive/_probe-batch-generate-20261031/*.png
 * 用法: node tools/archive/_probe-batch-generate-20261031/_probe-batch-generate.mjs
 *
 * ⚠ 只读:本探针**不点「确定生单」**(不往任何账套写单据),只截界面。
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const UI = 'http://localhost:5173'
const API = 'http://127.0.0.1:8090'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const OUT = 'tools/archive/_probe-batch-generate-20261031'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })

const lg = await (await fetch(API + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = lg.data.token

const profile = mkdtempSync(join(tmpdir(), 'edge-bg-'))
const edge = spawn(EDGE, ['--headless=new', '--remote-debugging-port=9337', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' })

let ws, msgId = 0
const pending = new Map()
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch('http://127.0.0.1:9337/json/list')).json()
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) {
      ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
      ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
      break
    }
  } catch {}
  await sleep(500)
}
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  if (r.result?.data) writeFileSync(join(OUT, name), Buffer.from(r.result.data, 'base64'))
  console.log('  -> ' + OUT + '/' + name)
}
// ⚠ mes_locale 按**裸值**存(locale.js 直接 localStorage.getItem → 不做 JSON.parse),
//   写成 JSON 字符串(带引号)会被当成非法 locale ⇒ 界面仍显示中文,英文走查就成了空跑。
const setLocale = async (loc) => { await ev(`localStorage.setItem('mes_locale', ${JSON.stringify(loc)}); 'ok'`) }

await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: UI + '/#/login' })
await sleep(3000)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))}); 'ok'`)
await setLocale('zh-CN')

/** 进面板列表页:导航 → reload → hash → 等 .doc-select-rail */
async function openPanel(code, withRail = true) {
  await send('Page.navigate', { url: UI + '/#/panelx/list/' + code })
  await sleep(2200)
  await send('Page.reload', { ignoreCache: true })
  await sleep(5500)
  await ev(`location.hash = '#/panelx/list/${code}'; 'ok'`)
  for (let i = 0; i < 40; i++) {
    const ok = withRail
      ? await ev(`!!document.querySelector('.doc-select-rail')`)
      : await ev(`!!document.querySelector('.tools .tb-group')`)
    if (ok) break
    await sleep(400)
  }
  await sleep(1200)
}
/** 点生单组的主按钮(不点下拉) */
const clickGenerateMain = () => ev(`(() => {
  const groups = [...document.querySelectorAll('.tools .tb-group')]
  const g = groups.find(x => (x.querySelector('.act-name')?.innerText || '').trim() === '生单')
  if (!g) return false
  g.querySelector('.tb-main')?.click()
  return true
})()`)
/** 生单组(中文叫「生单」,英文叫 tt('生单')= Generate) */
const GEN_GROUP_FIND = `[...document.querySelectorAll('.tools .tb-group')]
  .find(x => /^(生单|Generate)$/i.test((x.querySelector('.act-name')?.innerText || '').trim()))`

/** 打开生单组下拉并点某一项(下拉已开时不再点 caret,否则会把它关掉) */
const clickGenerateItem = (label) => ev(`(() => {
  const g = ${GEN_GROUP_FIND}
  if (!g) return false
  if (!g.querySelector('.tb-menu')) g.querySelector('.tb-caret')?.click()
  return true
})()`).then(async (ok) => {
  if (!ok) return false
  for (let attempt = 0; attempt < 2; attempt++) {
    await sleep(400)
    const done = await ev(`(() => {
      const items = [...document.querySelectorAll('.tools .tb-menu .ctx-item')]
      const it = items.find(x => x.innerText.trim() === ${JSON.stringify(label)})
      if (!it) return false
      it.click()
      return true
    })()`)
    if (done) return true
    // 菜单被前面的读取动作关掉了:再开一次
    await ev(`(() => { const g = ${GEN_GROUP_FIND}; g?.querySelector('.tb-caret')?.click(); return true })()`)
  }
  return false
})
const dialogSummary = () => ev(`(() => {
  const docs = [...document.querySelectorAll('.gl-doc')]
  return {
    title: document.querySelector('.el-dialog .el-dialog__title')?.innerText.trim(),
    docCount: docs.length,
    docNos: docs.map(d => d.querySelector('.gl-doc-no')?.innerText.trim()),
    columns: docs[0] ? [...docs[0].querySelectorAll('thead th')].map(t => t.innerText.trim()).filter(Boolean) : [],
    rowCounts: docs.map(d => d.querySelectorAll('tbody tr').length),
    pills: docs.map(d => d.querySelector('.gl-picked')?.innerText.trim()),
    foot: document.querySelector('.gl-foot')?.innerText.trim(),
    bar: [...document.querySelectorAll('.gl-bar .gl-chip, .gl-bar .gl-tip')].map(x => x.innerText.trim()).slice(0, 3),
    firstRowTexts: docs[0] ? [...docs[0].querySelectorAll('tbody tr')].slice(0, 2).map(tr => tr.innerText.replace(/\\s+/g, ' ').trim()) : [],
  }
})()`)
const closeDialog = () => ev(`(() => { const btns=[...document.querySelectorAll('.el-dialog__footer button')]; const b=btns.find(x=>x.innerText.trim()==='取消'||x.innerText.trim()==='Cancel'); if(b) b.click(); return true })()`)

/**
 * 关掉所有生单对话框并**等它们真的从 DOM 消失**。
 * 为什么必须等:下一个场景要是直接读 `.gl-doc`,读到的是上一个还挂着的对话框 ⇒ 结论错误
 * (实测:F 场景"单张生单"读到了 E 场景两张单的残影)。
 */
const ensureNoDialog = async () => {
  for (let i = 0; i < 10; i++) {
    if (!(await ev(`document.querySelectorAll('.gl-doc, .bsd, .bsd-printed').length`))) return true
    await ev(`(() => { [...document.querySelectorAll('.el-dialog__headerbtn')].forEach(b => b.click()); return true })()`)
    await sleep(450)
  }
  console.log('  ⚠ 对话框没能关掉(继续跑,但下面读到的可能是残影)')
  return false
}

// ============ A. 采购订单:左栏勾两张 → 生单 ▼ → 批量生单 ============
console.log('== A. 采购订单 批量生单 ==')
await openPanel('PU_ORDER')
console.log('  左栏表头 =', JSON.stringify(await ev(`[...document.querySelectorAll('.doc-select-rail thead th')].map(th=>th.innerText.trim())`)))
await shot('01-rail-with-checkbox.png')
const clicked = await ev(`(() => {
  const trs = [...document.querySelectorAll('.doc-select-rail tbody tr')].slice(0, 2)
  let n = 0
  for (const tr of trs) { const b = tr.querySelector('td.dsr-check .el-checkbox'); if (b) { b.click(); n++ } }
  return n
})()`)
await sleep(500)
console.log('  勾选', clicked, '张 →', JSON.stringify(await ev(`document.querySelector('.dsr-picked')?.innerText.trim()`)))
await shot('02-rail-checked.png')
console.log('  打开生单下拉 =', await clickGenerateItem('批量生单'))
for (let i = 0; i < 40; i++) { if (await ev(`!!document.querySelector('.gl-doc')`)) break; await sleep(300) }
await sleep(800)
console.log('  对话框:', JSON.stringify(await dialogSummary(), null, 1))
await shot('03-batch-dialog.png')
await ensureNoDialog()

// ============ B. 采购订单:生单(主按钮)= 原分批送料对话框(不能被顶掉) ============
console.log('== B. 采购订单 生单(原分批送料对话框) ==')
console.log('  点生单 =', await clickGenerateMain())
await sleep(2500)
console.log('  标题 =', JSON.stringify(await ev(`document.querySelector('.el-dialog .el-dialog__title')?.innerText.trim()`)))
console.log('  分批对话框存在 =', await ev(`!!document.querySelector('.bsd')`))
await shot('04-pu-batch-send-dialog.png')
await ensureNoDialog()

// ============ C. 销售订单:生单(主按钮 → 生成生产工单)/ 下拉 → 生成销售出库单 ============
console.log('== C. 销售订单 生单组 ==')
await openPanel('SO_ORDER')
console.log('  下拉项 =', JSON.stringify(await ev(`(() => {
  const g = ${GEN_GROUP_FIND}
  if (!g) return []
  g.querySelector('.tb-caret')?.click()
  return []
})()`).then(async () => { await sleep(400); return ev(`[...document.querySelectorAll('.tools .tb-menu .ctx-item')].map(x=>x.innerText.trim())`) })))
console.log('  点生单(主按钮,= 生成生产工单) =', await clickGenerateMain())
for (let i = 0; i < 40; i++) { if (await ev(`!!document.querySelector('.gl-doc')`)) break; await sleep(300) }
await sleep(800)
console.log('  对话框:', JSON.stringify(await dialogSummary(), null, 1))
await shot('05a-so-manu-order-dialog.png')
await ensureNoDialog()
console.log('  点生成销售出库单 =', await clickGenerateItem('生成销售出库单'))
for (let i = 0; i < 40; i++) { if (await ev(`!!document.querySelector('.gl-doc')`)) break; await sleep(300) }
await sleep(800)
console.log('  对话框:', JSON.stringify(await dialogSummary(), null, 1))
await shot('05-so-single-dialog.png')
await ensureNoDialog()

// ============ D. 同一对话框切英文(多语言红线) ============
console.log('== D. 英文界面走查 ==')
await setLocale('en')
await openPanel('SO_ORDER')
console.log('  工具栏 =', JSON.stringify(await ev(`[...document.querySelectorAll('.tools .tb-group .act-name')].map(x=>x.innerText.trim())`)))
// 英文下的动作名 = tt('生成销售出库单') → 'Generate Sales Issue'(见 i18n/locales/en.js)
console.log('  点 Generate Sales Issue =', await clickGenerateItem('Generate Sales Issue'))
for (let i = 0; i < 40; i++) { if (await ev(`!!document.querySelector('.gl-doc')`)) break; await sleep(300) }
await sleep(900)
console.log('  EN 对话框:', JSON.stringify(await dialogSummary(), null, 1))
await shot('06-en-dialog.png')
await ensureNoDialog()
await setLocale('zh-CN')

// ============ E. 送料暂收单:本次修的就是它(之前没有勾选、也不能批量) ============
console.log('== E. 送料暂收单 生单 ▼ → 批量生单(一条动作两个去向) ==')
await openPanel('QC_RECV')
console.log('  左栏表头 =', JSON.stringify(await ev(`[...document.querySelectorAll('.doc-select-rail thead th')].map(th=>th.innerText.trim())`)))
console.log('  勾选框数 =', await ev(`document.querySelectorAll('.doc-select-rail tbody td.dsr-check').length`))
const qcClicked = await ev(`(() => {
  const trs = [...document.querySelectorAll('.doc-select-rail tbody tr')].slice(0, 2)
  let n = 0
  for (const tr of trs) { const b = tr.querySelector('td.dsr-check .el-checkbox'); if (b) { b.click(); n++ } }
  return n
})()`)
await sleep(500)
console.log('  勾选', qcClicked, '张 →', JSON.stringify(await ev(`document.querySelector('.dsr-picked')?.innerText.trim()`)))
await shot('07-qc-recv-rail-checked.png')
console.log('  下拉项 =', JSON.stringify(await ev(`(() => {
  const g = ${GEN_GROUP_FIND}
  if (!g) return []
  g.querySelector('.tb-caret')?.click()
  return []
})()`).then(async () => { await sleep(350); return ev(`[...document.querySelectorAll('.tools .tb-menu .ctx-item')].map(x=>x.innerText.trim())`) })))
console.log('  点批量生单 =', await clickGenerateItem('批量生单'))
for (let i = 0; i < 40; i++) { if (await ev(`!!document.querySelector('.gl-doc')`)) break; await sleep(300) }
await sleep(900)
console.log('  对话框:', JSON.stringify(await dialogSummary(), null, 1))
await shot('08-qc-recv-batch-dialog.png')
await ensureNoDialog()

// ============ F. 送料暂收单:单张生单(主按钮)= 同一个对话框(以前是一把梭) ============
console.log('== F. 送料暂收单 生单(主按钮) ==')
console.log('  点生单 =', await clickGenerateMain())
for (let i = 0; i < 40; i++) { if (await ev(`!!document.querySelector('.gl-doc')`)) break; await sleep(300) }
await sleep(800)
console.log('  对话框:', JSON.stringify(await dialogSummary(), null, 1))
await shot('09-qc-recv-single-dialog.png')
await ensureNoDialog()

try { edge.kill() } catch {}
console.log('DONE(未生成任何单据)')
process.exit(0)
