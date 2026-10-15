/**
 * 截图(2026-10-15):按《MES管理系统-界面截图.docx》的 18 张图**重新截图**。
 *
 * 背景(用户口径):左侧 logo 的系统名已从「轻MES」改成「银嘉数字化平台」,旧图文不一致,
 *   要求「真实登录本地系统重新为上面两个文档截图」。
 * 前置:8090(jar,前端已内置)或 5173 均可;本脚本默认打 8090(所见即部署产物)。
 *
 * 输出:tools/archive/_shots-mes-1015/<序号>-<名称>.png(供后续替换 docx 内 media)
 * 只读浏览 + 登录,不写任何业务数据。
 *
 * 用法: node tools/archive/_shot-mes-doc-1015.mjs [host]
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

// 文档顺序(1..18);kind: route=路由;panel=面板列表;desk=桌面(需点模块页签)
const SHOTS = [
  { n: 1, name: '组织架构', kind: 'route', path: '/sys/org' },
  { n: 2, name: '使用权限查看', kind: 'route', path: '/sys/usage' },
  { n: 3, name: '数据字典', kind: 'panel', code: 'ZDGL' },
  { n: 4, name: '工艺路线', kind: 'panel', code: 'ROUTE' },
  { n: 5, name: '商品档案', kind: 'panel', code: 'INV' },
  { n: 6, name: '生产工单', kind: 'panel', code: 'MANU_ORDER' },
  { n: 7, name: '快速排产', kind: 'route', path: '/prod/plan/scheduleBoard' },
  { n: 8, name: '快速排产-2', kind: 'route', path: '/prod/plan/scheduleBoard' },
  { n: 9, name: '工单排产', kind: 'route', path: '/prod/plan/workOrderBoard' },
  { n: 10, name: '报工记录', kind: 'panel', code: 'WO_REPORT_LIST' },
  { n: 11, name: '生产异常处理单', kind: 'panel', code: 'PROD_ABN' },
  { n: 12, name: '来料检验单', kind: 'panel', code: 'QC_INSP' },
  { n: 13, name: '来料检验单-2', kind: 'panel', code: 'QC_INSP' },
  { n: 14, name: '检验数据记录', kind: 'panel', code: 'QC_INSP_REC' },
  { n: 15, name: '检验数据记录-2', kind: 'panel', code: 'QC_INSP_REC' },
  { n: 16, name: '我的桌面', kind: 'desk', mod: 'overview' },
  { n: 17, name: '我的桌面-生产管理', kind: 'desk', mod: 'prod' },
  { n: 18, name: '我的桌面-研发管理', kind: 'desk', mod: 'rd' },
]

const profile = mkdtempSync(join(tmpdir(), 'edge-shots-'))
const port = 9341
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

// ---- 登录 ----
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
console.log('[boot] 已登录 8090\n')

async function go(hash) {
  await ev(`location.hash = ${JSON.stringify(hash)}; 'ok'`)
  await sleep(4200)
}
async function shot(file) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (!r.result?.data) { console.log('  [FAIL] 截图失败 ' + file); return false }
  writeFileSync(join(OUT, file), Buffer.from(r.result.data, 'base64'))
  return true
}

let ok = 0
for (const s of SHOTS) {
  const file = `${String(s.n).padStart(2, '0')}-${s.name}.png`
  if (s.kind === 'route') await go('#' + s.path)
  else if (s.kind === 'panel') await go('#/panelx/list/' + s.code)
  else if (s.kind === 'desk') {
    await go('#/dashboard')
    // 点模块页签(概览/研发管理/生产/库存/销售/质量)
    const label = { overview: '概览', prod: '生产', rd: '研发管理' }[s.mod]
    const clicked = await ev(`(() => {
      const els = [...document.querySelectorAll('.mod-tab, .dash-mod, [class*=mod]')];
      const t = els.find(e => (e.textContent||'').trim() === ${JSON.stringify(label)});
      if (t) { t.click(); return true } return false;
    })()`)
    await sleep(3500)
    console.log(`  (桌面页签「${label}」点击=${clicked})`)
  }
  const done = await shot(file)
  if (done) { ok++; console.log(`[${s.n}/18] ${file}`) }
}
console.log(`\n完成 ${ok}/18 -> ${OUT}`)
try { edge.kill() } catch {}
process.exit(ok === 18 ? 0 : 1)
