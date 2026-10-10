/*
 * _verify-sched-dialog-row.mjs — 「生产工单 → 勾某一行 → 排产」弹窗只出该行(2026-10-15 界面取证)
 *
 * 【用户报障】「当前勾选单一工单号+行号的一条单据,同样会显示全部的相同工单号的在快速排产内筛选」
 *   生产工单页勾**一行**点「排产」,弹出的内嵌快速排产原来只按 **工单号** 预置关键字
 *   ⇒ 该工单**其它行**也一起列出来(用户截图:MO-2026-10-0004 只勾一行,列表出 3 行)。
 *
 * 【验什么】勾 行号=2 那一行 → 点「排产」→ 弹窗内快速排产的
 *   ① 关键字框 = "MO-2026-10-0004#2"(标识形式)
 *   ② 待排产列表**只有 1 行**,且行号 = 2
 *
 * ⚠ 只读(打开弹窗后不点确认排产,不写数据);截图存 tools/archive/。
 * 用法: node tools/archive/_verify-sched-dialog-row.mjs [baseUrl]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import WebSocket from '../../tools/node_modules/ws/index.js'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
// 勾选行数:1 = 单行(关键字=工单号#行号);2 = 多行(限定行id 列表)。
// 2026-10-15 用户报障「当前我勾选两个,进入排产的只有一个单据」⇒ 默认验 2 行。
const PICK_N = Number((process.argv.find((a) => a.startsWith('--rows=')) || '--rows=2').split('=')[1]) || 2
const PORT = 9357
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const WO = 'MO-2026-10-0004'
const PICK_XC = 2
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-sched-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1680,1100',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)

try {
  const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pending = new Map()
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
  const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(1200); return } } }
  const shoot = async (name) => {
    const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    if (s.result?.data) { const p = path.join('tools/archive', name); fs.writeFileSync(p, Buffer.from(s.result.data, 'base64')); console.log(`  截图 ${p}`) }
  }
  await send('Page.enable'); await send('Runtime.enable')

  await navigate(`${BASE}/#/login`)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))});
    localStorage.setItem('mes_locale', 'zh-CN'); localStorage.setItem('mes_init_done', '1'); 'ok'`)
  await navigate('about:blank')
  await navigate(`${BASE}/#/prod/plan/workOrderList`)
  await sleep(6000)
  await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click();return 'skip'} const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click();return 'x'} return 'none' })()`)
  await sleep(1200)

  // 搜索出该工单
  await evaluate(`(() => {
    const inp=[...document.querySelectorAll('input')].find(i=>i.placeholder&&i.placeholder.includes('输入查询条件'))
    if(!inp) return 'no-input'
    const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
    setter.call(inp, ${JSON.stringify(WO)}); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'typed'
  })()`)
  await sleep(700)
  await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='查找'); if(b){b.click();return 'ok'} return 'no-btn' })()`)
  await sleep(4000)

  // 勾该工单的前 PICK_N 行
  const picked = await evaluate(`(() => {
    const clean = (s)=>(s||'').replace(/[\\n\\r\\t]/g,'').replace(/[⇅▲▼]/g,'').trim()
    const heads=[...document.querySelectorAll('.el-table__header th')].map(th=>clean(th.innerText))
    const iXc=heads.indexOf('工单行号'), iNo=heads.indexOf('工单号')
    const trs=[...document.querySelectorAll('.el-table__body tr')]
    let hit=0
    const got=[]
    for (const tr of trs) {
      if (hit >= ${PICK_N}) break
      const t=[...tr.querySelectorAll('td')].map(td=>clean(td.innerText))
      if (t[iNo]===${JSON.stringify(WO)}) {
        const cb=tr.querySelector('td .el-checkbox'); if(cb){cb.click();hit++;got.push(String(t[iXc]))}
      }
    }
    return { iNo, iXc, hit, rows: trs.length, got }
  })()`)
  console.log(`    表格列定位 工单号@${picked?.iNo} 工单行号@${picked?.iXc};总行数=${picked?.rows};勾中=${picked?.hit} 行号=${JSON.stringify(picked?.got)}`)
  ok(`① 勾中 ${PICK_N} 行`, picked?.hit === PICK_N, JSON.stringify(picked))
  await sleep(900)
  await shoot('_shot-sched-dialog-before.png')

  // 点「排产」打开弹窗
  const clicked = await evaluate(`(() => {
    const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='排产')
    if(!b) return 'no-btn'
    if (b.disabled) return 'disabled'
    b.click(); return 'ok'
  })()`)
  // ⚠ 提示条(ElMessage)3 秒自动消失,必须在点完**马上**读 —— 不能等 5 秒后再读(实测读到空串)
  await sleep(600)
  const tipEarly = await evaluate(`(() => {
    const m=[...document.querySelectorAll('.el-message')].map(x=>(x.innerText||'').trim())
    return m.join(' | ')
  })()`)
  await sleep(4400)
  console.log(`    点「排产」= ${clicked}`)
  ok('② 「排产」按钮可点(该行未排产)', clicked === 'ok', String(clicked))
  await shoot('_shot-sched-dialog-open.png')

  // 读弹窗内快速排产的关键字 + 待排产行数
  const inner = await evaluate(`(() => {
    const clean = (s)=>(s||'').replace(/[\\n\\r\\t]/g,'').replace(/[⇅▲▼]/g,'').trim()
    const dlgs=[...document.querySelectorAll('.el-dialog')].filter(d=>d.querySelector('.sb-page'))
    const dlg=dlgs[dlgs.length-1]
    if(!dlg) return { found:false }
    const kw=[...dlg.querySelectorAll('input')].find(i=>i.placeholder&&i.placeholder.includes('订单号'))
    const panels=[...dlg.querySelectorAll('.sb-page')]
    // 待排产 = 第一个明细表(标题「① 待排产」所在面板)
    const tables=[...dlg.querySelectorAll('.el-table__body-wrapper')]
    const heads=[...dlg.querySelectorAll('.el-table__header th')].map(th=>clean(th.innerText))
    const iXc=heads.indexOf('工单行号'), iNo=heads.indexOf('加工单号')
    const firstBody=dlg.querySelector('.el-table__body')
    const trs=firstBody?[...firstBody.querySelectorAll('tr')]:[]
    const rows=trs.map(tr=>{const t=[...tr.querySelectorAll('td')].map(td=>clean(td.innerText)); return { 单:t[iNo], 行:t[iXc] }})
    return { found:true, keyword: kw?kw.value:'(no-input)', iNo, iXc, tableCount: tables.length, rows }
  })()`)
  console.log(`    弹窗内关键字 = "${inner?.keyword}"`)
  console.log(`    弹窗内待排产表 首表 ${inner?.rows?.length} 行 = ${JSON.stringify(inner?.rows)}`)
  if (PICK_N === 1) {
    // 单行:关键字走「工单号#行号」标识形式,池里只剩这一行
    //   ⚠ 期望值用**实际勾中的行号**(页面第一行可能是 3 而不是 2),别写死
    const wantXc = String(picked?.got?.[0])
    ok(`③ 关键字被预置成「工单号#行号」= ${WO}#${wantXc}`,
      String(inner?.keyword) === `${WO}#${wantXc}`, String(inner?.keyword))
    ok(`④ 待排产只剩 1 行,且行号 = ${wantXc}`,
      (inner?.rows?.length === 1) && String(inner?.rows?.[0]?.['行']) === wantXc,
      JSON.stringify(inner?.rows))
  } else {
    // 多行:**按用户口径应被拦下**(排产一次只勾一行)—— 弹窗不该开,更不该出 N 行
    ok(`③ 勾 ${PICK_N} 行时**弹窗不开**(排产一次只勾一行)`, inner?.found !== true,
      `弹窗内关键字="${inner?.keyword}" 行数=${inner?.rows?.length}`)
    console.log(`    页面提示 = "${tipEarly}"`)
    ok('③ 给出明确提示(请只勾选一张工单)', String(tipEarly).includes('只勾选一张'), String(tipEarly))
  }

  console.log(`\n[结果] pass=${pass} fail=${fail}`)
  ws.close()
  process.exit(fail === 0 ? 0 : 1)
} finally {
  edge.kill()
  try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
}
