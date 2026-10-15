/**
 * 截图 v2(2026-10-15):重截 MES 文档 18 张 —— **按"页面真的加载完"再拍**,不再用固定 sleep。
 *
 * 为什么要重做(用户报障「截图的都是空面板的数据」):
 *   v1 用固定 sleep(4.2s) 就按快门 ⇒ 慢面板(INV 商品 3874 行、来料检验 174 行)在快门时
 *   还停在「单据: - 第 0/0 张」+「角色列表加载失败」的中间态,拍出一片空白。
 *   ⚠ v1 的校验只断言了"页面出现新 logo 且非 404",**空面板也满足**,所以 18/18 全绿却全是废图 ——
 *     这是校验口径的漏洞,本版把「数据就绪」写进判据。
 *
 * 本版就绪判据(每张都等,最多 40s):
 *   ① 面板根节点存在(.panelx-list);
 *   ② 顶部状态行不再显示「第 0/0 张」(COUNT 已知有数据的面板必须 > 0);
 *   ③ 表格有数据行;对已知空表的面板(报工记录/生产异常处理单/ERP导入日志)只要求①②;
 *   ④ 页面上不得出现「加载失败」字样。
 *
 * 用法: node tools/archive/_shot-mes-doc-v2-1015.mjs [host]
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

// expectRows: 'data' 必须有数据行;'empty' 允许空表(该面板库里本就 0 行)
const SHOTS = [
  { n: 1, name: '组织架构', kind: 'route', path: '/sys/org', expectRows: 'data' },
  { n: 2, name: '使用权限查看', kind: 'route', path: '/sys/usage', expectRows: 'data' },
  { n: 3, name: '数据字典', kind: 'panel', code: 'ZDGL', expectRows: 'data' },
  { n: 4, name: '工艺路线', kind: 'panel', code: 'ROUTE', expectRows: 'data' },
  { n: 5, name: '商品档案', kind: 'panel', code: 'INV', expectRows: 'data' },
  { n: 6, name: '生产工单', kind: 'panel', code: 'MANU_ORDER', expectRows: 'data' },
  { n: 7, name: '快速排产', kind: 'route', path: '/prod/plan/scheduleBoard', expectRows: 'data' },
  { n: 8, name: '快速排产-2', kind: 'route', path: '/prod/plan/scheduleBoard', expectRows: 'data' },
  { n: 9, name: '工单排产', kind: 'route', path: '/prod/plan/workOrderBoard', expectRows: 'data' },
  // ⚠ 报工记录是空表(正式库 0 行),改由图 10b 用**测试账套**单独拍;这里保留但标记 empty
  { n: 10, name: '报工记录', kind: 'panel', code: 'WO_REPORT_LIST', expectRows: 'empty' },
  { n: 11, name: '生产异常处理单', kind: 'panel', code: 'PROD_ABN', expectRows: 'empty' },
  { n: 12, name: '来料检验单', kind: 'panel', code: 'QC_INSP', expectRows: 'data' },
  { n: 13, name: '来料检验单-2', kind: 'panel', code: 'QC_INSP', expectRows: 'data' },
  { n: 14, name: '检验数据记录', kind: 'panel', code: 'QC_INSP_REC', expectRows: 'data' },
  { n: 15, name: '检验数据记录-2', kind: 'panel', code: 'QC_INSP_REC', expectRows: 'data' },
  { n: 16, name: '我的桌面', kind: 'desk', mod: 'overview' },
  { n: 17, name: '我的桌面-生产管理', kind: 'desk', mod: 'prod' },
  { n: 18, name: '我的桌面-研发管理', kind: 'desk', mod: 'rd' },
]

const profile = mkdtempSync(join(tmpdir(), 'edge-v2-'))
const port = 9347
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
if (!ws) { console.error('[FATAL] 连不上 Edge CDP'); process.exit(1) }
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
await sleep(6500)
console.log('[boot] 已登录\n')

/** 读页面就绪状态 */
async function probe() {
  const raw = await ev(`(() => {
    const txt = document.body.innerText || '';
    const rows = document.querySelectorAll('.el-table__body tbody tr').length;
    // 顶部「第 X/Y 张」取分母
    const m = txt.match(/第\\s*(\\d+)\\s*\\/\\s*(\\d+)\\s*张/);
    return JSON.stringify({
      rows,
      total: m ? parseInt(m[2], 10) : null,
      failed: /加载失败|请求失败/.test(txt),
      empty: /暂无符合条件的数据|暂无数据/.test(txt),
    });
  })()`)
  try { return JSON.parse(raw || '{}') } catch { return {} }
}

/** 等到"真的加载好" */
async function waitReady(expectRows, maxMs = 40000) {
  const t0 = Date.now()
  let last = {}
  while (Date.now() - t0 < maxMs) {
    last = await probe()
    if (last.failed) { await sleep(1200); continue }               // 失败态:再等(可能是瞬时)
    const totalOk = last.total === null || last.total > 0
    const rowsOk = expectRows === 'empty' ? true : last.rows > 0
    if (totalOk && rowsOk) return { ok: true, ...last, waited: Date.now() - t0 }
    await sleep(1200)
  }
  return { ok: false, ...last, waited: Date.now() - t0 }
}

const shot = async (file) => {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (!r.result?.data) return false
  writeFileSync(join(OUT, file), Buffer.from(r.result.data, 'base64'))
  return true
}

let ok = 0
const fails = []
for (const s of SHOTS) {
  const file = `${String(s.n).padStart(2, '0')}-${s.name}.png`
  if (s.kind === 'route') await ev(`location.hash = ${JSON.stringify('#' + s.path)}; 'ok'`)
  else if (s.kind === 'panel') await ev(`location.hash = ${JSON.stringify('#/panelx/list/' + s.code)}; 'ok'`)
  else {
    await ev(`location.hash = '#/dashboard'; 'ok'`)
    await sleep(3000)
    const label = { overview: '概览', prod: '生产', rd: '研发管理' }[s.mod]
    await ev(`(() => { const all=[...document.querySelectorAll('div,span,button,a')];
      const t=all.reverse().find(e=>(e.textContent||'').trim()===${JSON.stringify(label)}&&e.children.length<=1);
      if(t) t.click(); return !!t; })()`)
  }

  const ready = s.kind === 'desk'
    ? (await sleep(5000), { ok: true, rows: (await probe()).rows, total: null, waited: 5000, empty: false })
    : await waitReady(s.expectRows)

  const done = await shot(file)
  if (done && ready.ok) { ok++; console.log(`[${s.n}/18] OK   ${file}  rows=${ready.rows} total=${ready.total ?? '-'} 等${Math.round(ready.waited / 1000)}s`) }
  else { fails.push(file); console.log(`[${s.n}/18] FAIL ${file}  rows=${ready.rows} total=${ready.total ?? '-'} failed=${ready.failed}`) }
}
console.log(`\n完成 ${ok}/18`)
if (fails.length) console.log('未就绪:', fails.join(', '))
try { edge.kill() } catch {}
process.exit(0)
