/**
 * 截图 v3(2026-10-15):MES 文档 18 张 —— 修掉 v1/v2 两个真问题后重拍。
 *
 * ── 为什么前两版是废图(用户报障「截图的都是空面板的数据」)──
 *   v1:固定 sleep 4.2s 就快门 ⇒ 慢面板(INV 3874 行)拍在「第 0/0 张」中间态;
 *       且校验只断言"有新 logo 且非 404",**空面板同样满足** ⇒ 18/18 全绿却全是空白图。
 *   v2:改用 location.hash 跳面板 ⇒ **同一路由只换 param 时 Vue Router 不重挂载,
 *       前端连查询请求都不发**(实测:INV 有 1 个请求 25 行;后续面板 **0 个请求** 0 行)。
 *   ⇒ v3 用 **Page.navigate(整页导航)** 强制重挂载,并按"请求真发出 + 数据真就绪"判定。
 *
 * ── v3 就绪判据(双保险)──
 *   ① 本次导航后**确实观测到 queryFormDataList 请求发出**(v2 的教训:没发就是没加载);
 *   ② 表格出现数据行(表里已知 0 行的面板除外),且不显示「加载失败」。
 *   任一不满足 ⇒ 重试该张(整页重载),最多 3 次;仍失败则报 FAIL 且**不覆盖**旧图。
 *
 * 用法: node tools/archive/_shot-mes-doc-v3-1015.mjs [host]
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

// expect: 'data' 必须有数据行;'empty' 库里本就 0 行(仍要求请求发出+页面正常)
const SHOTS = [
  { n: 1, name: '组织架构', url: '/#/sys/org', expect: 'data' },
  { n: 2, name: '使用权限查看', url: '/#/sys/usage', expect: 'data' },
  { n: 3, name: '数据字典', url: '/#/panelx/list/ZDGL', expect: 'data' },
  { n: 4, name: '工艺路线', url: '/#/panelx/list/ROUTE', expect: 'data' },
  { n: 5, name: '商品档案', url: '/#/panelx/list/INV', expect: 'data' },
  { n: 6, name: '生产工单', url: '/#/panelx/list/MANU_ORDER', expect: 'data' },
  { n: 7, name: '快速排产', url: '/#/prod/plan/scheduleBoard', expect: 'data' },
  { n: 8, name: '快速排产-2', url: '/#/prod/plan/scheduleBoard', expect: 'data' },
  { n: 9, name: '工单排产', url: '/#/prod/plan/workOrderBoard', expect: 'data' },
  { n: 10, name: '报工记录', url: '/#/panelx/list/WO_REPORT_LIST', expect: 'empty' },
  { n: 11, name: '生产异常处理单', url: '/#/panelx/list/PROD_ABN', expect: 'empty' },
  { n: 12, name: '来料检验单', url: '/#/panelx/list/QC_INSP', expect: 'data' },
  { n: 13, name: '来料检验单-2', url: '/#/panelx/list/QC_INSP', expect: 'data' },
  { n: 14, name: '检验数据记录', url: '/#/panelx/list/QC_INSP_REC', expect: 'data' },
  { n: 15, name: '检验数据记录-2', url: '/#/panelx/list/QC_INSP_REC', expect: 'data' },
  { n: 16, name: '我的桌面', url: '/#/dashboard', expect: 'desk', mod: '概览' },
  { n: 17, name: '我的桌面-生产管理', url: '/#/dashboard', expect: 'desk', mod: '生产' },
  { n: 18, name: '我的桌面-研发管理', url: '/#/dashboard', expect: 'desk', mod: '研发管理' },
]

const profile = mkdtempSync(join(tmpdir(), 'edge-v3-'))
const port = 9350
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1600,1000', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' })

let ws, msgId = 0
const pending = new Map()
let queryCount = 0
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) {
      ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data)
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
        if (m.method === 'Network.requestWillBeSent' && m.params.request.url.includes('queryFormDataList')) queryCount++
      }
      break
    }
  } catch {}
  await sleep(500)
}
if (!ws) { console.error('[FATAL] 连不上 Edge'); process.exit(1) }
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })

await send('Page.navigate', { url: host + '/#/login' })
await sleep(3500)
const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const TOKEN = lg.data.token
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(TOKEN)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))});`
  + `localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
// 注入后必须整页重载(token 才是 store 初值)
await send('Page.reload', { ignoreCache: true })
await sleep(7000)
console.log('[boot] 已登录\n')

async function st() {
  const raw = await ev(`(() => {
    const txt = document.body.innerText || '';
    const m = txt.match(/第\\s*(\\d+)\\s*\\/\\s*(\\d+)\\s*张/);
    return JSON.stringify({
      rows: document.querySelectorAll('.el-table__body tbody tr').length,
      total: m ? parseInt(m[2], 10) : null,
      failed: /加载失败|请求失败|服务异常/.test(txt),
    });
  })()`)
  try { return JSON.parse(raw || '{}') } catch { return {} }
}

/** 整页导航(强制重挂载)+ 等就绪 */
async function gotoAndWait(url, expect, maxMs = 30000) {
  const before = queryCount
  await send('Page.navigate', { url: host + url })
  const t0 = Date.now()
  let last = {}
  while (Date.now() - t0 < maxMs) {
    await sleep(1000)
    last = await st()
    if (last.failed) continue
    if (expect === 'desk') { if (last.rows > 0 || (await ev(`!!document.querySelector('.dash, .dashboard, [class*=dash]')`))) return { ok: true, ...last, req: queryCount - before } }
    else {
      const dataOk = expect === 'empty' ? true : last.rows > 0
      // 面板页还要求「查询请求真的发出去过」(v2 的坑:没发请求就是没加载)
      if (dataOk && last.rows >= 0 && (queryCount - before) > 0) return { ok: true, ...last, req: queryCount - before }
    }
  }
  return { ok: false, ...last, req: queryCount - before }
}

let ok = 0
const fails = []
for (const s of SHOTS) {
  const file = `${String(s.n).padStart(2, '0')}-${s.name}.png`
  let ready = { ok: false }
  for (let attempt = 1; attempt <= 3 && !ready.ok; attempt++) {
    ready = await gotoAndWait(s.url, s.expect)
    if (!ready.ok) console.log(`   (${file} 第 ${attempt} 次未就绪 rows=${ready.rows} req=${ready.req},重试)`)
  }
  if (ready.ok) {
    // 桌面视图要额外点模块页签(概览/生产/研发管理)
    if (s.expect === 'desk' && s.mod) {
      await ev(`(() => { const all=[...document.querySelectorAll('div,span,button,a')];
        const t=all.reverse().find(e=>(e.textContent||'').trim()===${JSON.stringify(s.mod)}&&e.children.length<=1);
        if(t) t.click(); return !!t; })()`)
      await sleep(5000)
    }
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    if (r.result?.data) {
      writeFileSync(join(OUT, file), Buffer.from(r.result.data, 'base64'))
      ok++
      console.log(`[${s.n}/18] OK   ${file}  rows=${ready.rows} total=${ready.total ?? '-'} req=${ready.req}`)
      continue
    }
  }
  fails.push(file)
  console.log(`[${s.n}/18] FAIL ${file}  rows=${ready.rows} req=${ready.req}(未覆盖旧图)`)
}
console.log(`\n完成 ${ok}/18`)
if (fails.length) console.log('失败(保持旧图):', fails.join(', '))
try { edge.kill() } catch {}
process.exit(0)
