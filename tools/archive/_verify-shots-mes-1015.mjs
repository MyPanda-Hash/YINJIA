/**
 * 校验(2026-10-15):18 张重截图是否**真的拍到了系统**(而不是白屏/404/登录页)。
 *
 * 判据(逐张打开,只读):
 *   ① 页面里必须出现「银嘉数字化平台」(左上 logo)—— 这正是本次重截的原因;
 *   ② 不能出现「轻MES」(旧名,出现即说明拍到的是旧前端/缓存);
 *   ③ 页面文字长度 > 200(排除白屏);且不含「404」「页面不存在」。
 * 用法: node tools/archive/_verify-shots-mes-1015.mjs [host]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const host = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const DIR = 'tools/archive/_shots-mes-1015'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 与截图脚本同一套路由
const ROUTES = {
  '01-组织架构': '#/sys/org',
  '02-使用权限查看': '#/sys/usage',
  '03-数据字典': '#/panelx/list/ZDGL',
  '04-工艺路线': '#/panelx/list/ROUTE',
  '05-商品档案': '#/panelx/list/INV',
  '06-生产工单': '#/panelx/list/MANU_ORDER',
  '07-快速排产': '#/prod/plan/scheduleBoard',
  '08-快速排产-2': '#/prod/plan/scheduleBoard',
  '09-工单排产': '#/prod/plan/workOrderBoard',
  '10-报工记录': '#/panelx/list/WO_REPORT_LIST',
  '11-生产异常处理单': '#/panelx/list/PROD_ABN',
  '12-来料检验单': '#/panelx/list/QC_INSP',
  '13-来料检验单-2': '#/panelx/list/QC_INSP',
  '14-检验数据记录': '#/panelx/list/QC_INSP_REC',
  '15-检验数据记录-2': '#/panelx/list/QC_INSP_REC',
  '16-我的桌面': '#/dashboard',
  '17-我的桌面-生产管理': '#/dashboard',
  '18-我的桌面-研发管理': '#/dashboard',
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.png')).sort()
const profile = mkdtempSync(join(tmpdir(), 'edge-ver-'))
const port = 9343
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' })

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
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: host + '/#/login' })
await sleep(3500)
const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(lg.data.user && JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))});`
  + `localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
await send('Page.reload', { ignoreCache: true })
await sleep(6500)

let pass = 0, total = 0
for (const f of files) {
  total++
  const key = f.replace(/\.png$/, '')
  const hash = ROUTES[key]
  if (!hash) { console.log(`[SKIP] ${f} (无路由映射)`); total--; continue }
  await ev(`location.hash = ${JSON.stringify(hash)}; 'ok'`)
  await sleep(3800)
  const info = await ev(`(() => {
    const t = document.body.innerText || '';
    const logo = [...document.querySelectorAll('.logo, [class*=logo]')].map(e=>(e.textContent||'').trim()).join('|');
    return JSON.stringify({ len: t.length, logo, hasNew: /银嘉数字化平台/.test(t), hasOld: /轻\\s*MES/.test(t), is404: /404|页面不存在/.test(t) });
  })()`)
  const d = JSON.parse(info || '{}')
  const ok = d.len > 200 && d.hasNew && !d.hasOld && !d.is404
  if (ok) pass++
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${f}  len=${d.len} 新名=${d.hasNew} 旧名=${d.hasOld} 404=${d.is404} logo「${(d.logo||'').slice(0,20)}」`)
}
console.log(`\n结果: ${pass}/${total}`)
try { edge.kill() } catch {}
process.exit(pass === total ? 0 : 1)
