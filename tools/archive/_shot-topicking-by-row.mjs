/*
 * _shot-topicking-by-row.mjs — 「转领料单」按 工单号+工单行号 出单的界面取证(2026-10-15,只读)
 *
 * 用户口径:「工单号+工单行号 就为当前的一个新的单的模式」。
 * 本脚本在**生产工单列表**上勾选同一工单的多行 → 点「转领料单」→ 截确认框与结果提示,
 * 再到**材料出库单**列表看每张单的 加工单号 + 工单行号。
 *
 * ⚠ 只做"看界面"的取证:确认框出现后**点取消**(不真正转单,不写数据)。
 * 用法: node tools/archive/_shot-topicking-by-row.mjs [baseUrl]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import WebSocket from '../../tools/node_modules/ws/index.js'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9351
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const OUT_DIR = 'tools/archive'

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-shot2-'))
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
    if (s.result?.data) { const p = path.join(OUT_DIR, name); fs.writeFileSync(p, Buffer.from(s.result.data, 'base64')); console.log(`  截图 ${p} (${Math.round(fs.statSync(p).size / 1024)} KB)`) }
  }
  await send('Page.enable'); await send('Runtime.enable')

  await navigate(`${BASE}/#/login`)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))});
    localStorage.setItem('mes_locale', 'zh-CN'); localStorage.setItem('mes_init_done', '1'); 'ok'`)
  await navigate('about:blank')
  await navigate(`${BASE}/#/prod/plan/workOrderList`)
  await sleep(6000)

  // 关掉可能弹出的初始化向导
  await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click();return 'skip'} const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click();return 'x'} return 'none' })()`)
  await sleep(1200)

  // 搜索出 GD-2026-10-0002 的多行
  await evaluate(`(() => {
    const inp=[...document.querySelectorAll('input')].find(i=>i.placeholder&&i.placeholder.includes('输入查询条件'))
    if(!inp) return 'no-input'
    const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
    setter.call(inp,'GD-2026-10-0002'); inp.dispatchEvent(new Event('input',{bubbles:true}))
    return 'typed'
  })()`)
  await sleep(800)
  await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='查找'); if(b){b.click();return 'ok'} return 'no-btn' })()`)
  await sleep(4000)

  const rowInfo = await evaluate(`(() => {
    const trs=[...document.querySelectorAll('.el-table__body tr')]
    return trs.map(tr=>[...tr.querySelectorAll('td')].map(td=>(td.innerText||'').trim())).filter(t=>t.includes('GD-2026-10-0002')).length
  })()`)
  console.log(`  列表命中 ${rowInfo} 行`)
  await shoot('_shot-topicking-list-rows.png')

  // 勾选前 3 行(勾选框在第一个 td)
  await evaluate(`(() => {
    const trs=[...document.querySelectorAll('.el-table__body tr')].filter(tr=>[...tr.querySelectorAll('td')].some(td=>(td.innerText||'').trim()==='GD-2026-10-0002'))
    let n=0
    for (const tr of trs.slice(0,3)) { const cb=tr.querySelector('td .el-checkbox'); if(cb){cb.click();n++} }
    return n
  })()`)
  await sleep(1200)

  // 点「转领料单」→ 出现确认框(只截图,随后取消)
  const clicked = await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='转领料单'); if(b){b.click();return 'ok'} return 'no-btn' })()`)
  await sleep(2000)
  const confirmText = await evaluate(`(() => { const b=document.querySelector('.el-message-box__message'); return b?b.innerText.trim():'(无确认框)' })()`)
  console.log(`  转领料单按钮=${clicked} 确认框="${confirmText}"`)
  await shoot('_shot-topicking-confirm.png')

  // 取消(不写数据)
  await evaluate(`(() => { const b=[...document.querySelectorAll('.el-message-box button')].find(x=>(x.innerText||'').trim()==='取消'); if(b){b.click();return 'cancelled'} return 'no-cancel' })()`)
  await sleep(1000)

  // 材料出库单列表:看 加工单号 + 工单行号
  await navigate(`${BASE}/#/panelx/list/MATERIAL_OUT`)
  await sleep(6000)
  const mo = await evaluate(`(() => {
    const trs=[...document.querySelectorAll('.el-table__body tr')]
    // ⚠ 表头文案带排序箭头(如 "工单行号\\n⇅"),必须剥掉再比 —— 首轮探针就是因此误判"没有该列"
    const clean = (s) => (s||'').replace(/[\\n\\r\\t]/g,'').replace(/[⇅▲▼]/g,'').trim()
    const heads=[...document.querySelectorAll('.el-table__header th')].map(th=>clean(th.innerText))
    const iNo=heads.indexOf('加工单号'), iXc=heads.indexOf('工单行号'), iId=heads.indexOf('单据编号')
    return { heads: heads.slice(0,12), idx:{单:iId,加工单号:iNo,工单行号:iXc},
      rows: trs.slice(0,8).map(tr=>{const t=[...tr.querySelectorAll('td')].map(td=>clean(td.innerText));
        return { 单:t[iId], 加工单号:t[iNo], 工单行号:t[iXc] }}) }
  })()`)
  console.log(`  材料出库单列头 = ${JSON.stringify(mo.heads)}`)
  console.log(`  前几行 = ${JSON.stringify(mo.rows)}`)
  await shoot('_shot-topicking-material-out.png')

  const hasXc = (mo.heads || []).includes('工单行号')
  console.log(`\n[结果] 列表有「工单行号」列=${hasXc} 确认框文案=${confirmText}`)
  ws.close()
  process.exit(hasXc ? 0 : 1)
} finally {
  edge.kill()
  try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
}
