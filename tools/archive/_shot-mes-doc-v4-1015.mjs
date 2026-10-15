/**
 * 截图 v4(2026-10-15):MES 文档 18 张 —— 最终版,修掉前面所有已知坑。
 *
 * ── 三版踩坑史(留档,别再犯)──
 *   v1:固定 sleep 4.2s 快门 ⇒ 慢面板拍在「第 0/0 张」中间态;且校验只看"有新 logo 且非 404",
 *      **空面板也满足** ⇒ 18/18 全绿却全是废图。
 *   v2:改 location.hash 跳面板 ⇒ **同一路由只换 param,Vue Router 不重挂载,前端根本不发查询请求**
 *      (实测:INV 1 个请求 25 行;后续面板 0 个请求 0 行)。
 *   v3:改整页 Page.navigate(对)但就绪判据要求 queryFormDataList 请求数 > 0 ⇒
 *      **非面板路由(组织架构/权限/排产)走的是别的接口,永远 0** ⇒ 全部误判 FAIL 并反复重试(看着像卡死)。
 *
 * ── v4 判据(分类型,不再一刀切)──
 *   · panel 型:等表格出现数据行(库里已知 0 行的 3 张除外,只要求页面正常且不是失败态);
 *   · route/desk 型:等**页面主体内容渲染出来**(body 文本长度达标 + 无失败字样),
 *     不看 queryFormDataList(它们不走那个接口)。
 *   · 每张最多重试 2 次;失败**不覆盖**旧图,并在末尾列出。
 * 用法: node tools/archive/_shot-mes-doc-v4-1015.mjs [host]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const host = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const OUT = 'tools/archive/_shots-mes-1015'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })

// kind: panel(表格型) / route(页面型) / desk(桌面,需点页签)
// minRows: 该界面**预期**至少多少数据行(取自实测库计数,避免"空表也算过")
const SHOTS = [
  { n: 1, name: '组织架构', url: '/#/sys/org', kind: 'route', minLen: 600 },
  { n: 2, name: '使用权限查看', url: '/#/sys/usage', kind: 'route', minLen: 600 },
  { n: 3, name: '数据字典', url: '/#/panelx/list/ZDGL', kind: 'panel', minRows: 1 },
  { n: 4, name: '工艺路线', url: '/#/panelx/list/ROUTE', kind: 'panel', minRows: 1 },
  { n: 5, name: '商品档案', url: '/#/panelx/list/INV', kind: 'panel', minRows: 1 },
  { n: 6, name: '生产工单', url: '/#/panelx/list/MANU_ORDER', kind: 'panel', minRows: 1 },
  { n: 7, name: '快速排产', url: '/#/prod/plan/scheduleBoard', kind: 'route', minLen: 400 },
  { n: 8, name: '快速排产-2', url: '/#/prod/plan/scheduleBoard', kind: 'route', minLen: 400 },
  { n: 9, name: '工单排产', url: '/#/prod/plan/workOrderBoard', kind: 'route', minLen: 400 },
  { n: 10, name: '报工记录', url: '/#/panelx/list/WO_REPORT_LIST', kind: 'panel', minRows: 0 },
  { n: 11, name: '生产异常处理单', url: '/#/panelx/list/PROD_ABN', kind: 'panel', minRows: 0 },
  { n: 12, name: '来料检验单', url: '/#/panelx/list/QC_INSP', kind: 'panel', minRows: 1 },
  { n: 13, name: '来料检验单-2', url: '/#/panelx/list/QC_INSP', kind: 'panel', minRows: 1 },
  { n: 14, name: '检验数据记录', url: '/#/panelx/list/QC_INSP_REC', kind: 'panel', minRows: 1 },
  { n: 15, name: '检验数据记录-2', url: '/#/panelx/list/QC_INSP_REC', kind: 'panel', minRows: 1 },
  { n: 16, name: '我的桌面', url: '/#/dashboard', kind: 'desk', mod: '概览', minLen: 400 },
  { n: 17, name: '我的桌面-生产管理', url: '/#/dashboard', kind: 'desk', mod: '生产', minLen: 400 },
  { n: 18, name: '我的桌面-研发管理', url: '/#/dashboard', kind: 'desk', mod: '研发管理', minLen: 400 },
]

const profile = mkdtempSync(join(tmpdir(), 'edge-v4-'))
const port = 9351
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1600,1000', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' })

let ws, msgId = 0
const pending = new Map()
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
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
if (!ws) { console.error('[FATAL] 连不上 Edge'); process.exit(1) }
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })

await send('Page.navigate', { url: host + '/#/login' })
await sleep(3500)
const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))});`
  + `localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
await send('Page.reload', { ignoreCache: true })
await sleep(7000)
console.log('[boot] 已登录\n')

async function st() {
  const raw = await ev(`(() => {
    const txt = document.body.innerText || '';
    return JSON.stringify({
      rows: document.querySelectorAll('.el-table__body tbody tr').length,
      len: txt.length,
      failed: /加载失败|请求失败|服务异常|角色列表加载失败/.test(txt),
      emptyTxt: /暂无符合条件的数据|暂无数据/.test(txt),
    });
  })()`)
  try { return JSON.parse(raw || '{}') } catch { return {} }
}

async function gotoAndWait(s, maxMs = 28000) {
  await send('Page.navigate', { url: host + s.url })
  const t0 = Date.now()
  let last = {}
  while (Date.now() - t0 < maxMs) {
    await sleep(1000)
    last = await st()
    if (last.failed) continue
    if (s.kind === 'panel') {
      if (last.rows >= Math.max(1, s.minRows)) return { ok: true, ...last }
      if (s.minRows === 0 && last.emptyTxt && last.rows === 0) return { ok: true, ...last }
    } else {
      if ((last.len || 0) >= s.minLen) return { ok: true, ...last }
    }
  }
  return { ok: false, ...last }
}

let ok = 0
const fails = []
for (const s of SHOTS) {
  const file = `${String(s.n).padStart(2, '0')}-${s.name}.png`
  let ready = { ok: false }
  for (let a = 1; a <= 2 && !ready.ok; a++) ready = await gotoAndWait(s)

  if (ready.ok && s.kind === 'desk' && s.mod) {
    await ev(`(() => { const all=[...document.querySelectorAll('div,span,button,a')];
      const t=all.reverse().find(e=>(e.textContent||'').trim()===${JSON.stringify(s.mod)}&&e.children.length<=1);
      if(t) t.click(); return !!t; })()`)
    await sleep(5000)
  }

  if (ready.ok) {
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    if (r.result?.data) {
      writeFileSync(join(OUT, file), Buffer.from(r.result.data, 'base64'))
      ok++
      console.log(`[${s.n}/18] OK   ${file}  rows=${ready.rows} len=${ready.len}`)
      continue
    }
  }
  fails.push(file)
  console.log(`[${s.n}/18] FAIL ${file}  rows=${ready.rows} len=${ready.len} failed=${ready.failed}(保留旧图)`)
}
console.log(`\n完成 ${ok}/18`)
if (fails.length) console.log('失败:', fails.join(', '))
try { edge.kill() } catch {}
process.exit(0)
