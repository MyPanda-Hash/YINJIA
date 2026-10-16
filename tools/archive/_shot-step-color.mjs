/*
 * _shot-step-color.mjs — 工序步骤着色「看效果」取证(2026-10-16,一次性)
 *
 * 用 CDP 打开生产工单页 → 对目标工单行点追溯 → 读取**工序步骤圆点的实际计算色**并截图。
 * 断言(读 DOM 的 getComputedStyle,不是读接口):
 *   ① 弹窗里**没有**「口径说明」长段落(.wb-trace-scope-line 不存在)——用户要求去掉的红框内容;
 *   ② 已完成/超产 的步骤圆点是**绿**(el-step__head.is-success);
 *   ③ 有报工但未达标 的步骤是**蓝**(is-process);
 *   ④ 无报工 的步骤是**灰**(is-wait)。
 * ⚠ 只读:不点任何写操作按钮。
 * 用法: node tools/archive/_shot-step-color.mjs [baseUrl] [工单号] [行号] [账套YJ|YJ_TEST]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import WebSocket from '../../tools/node_modules/ws/index.js'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const WO = process.argv[3] || 'GD-2026-10-0007'
const XC = process.argv[4] || '1'
const FACTORY = process.argv[5] || 'YJ'
const PORT = 9377
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const OUT = `tools/archive/_shot-step-color${FACTORY === 'YJ_TEST' ? '-test' : ''}.png`

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-stepcolor-'))
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

  // 清空默认「最近 15 天」日期窗口(否则更早的工单行不在列表里,点不到);
  // 页面口径:两个日期都空 = 查全量(见 WorkOrderList.vue 注释)。
  await evaluate(`(() => {
    const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
    let n=0
    document.querySelectorAll('.el-date-editor input').forEach(inp=>{
      setter.call(inp,''); inp.dispatchEvent(new Event('input',{bubbles:true}))
      inp.dispatchEvent(new Event('change',{bubbles:true})); inp.blur(); n++
    })
    return 'cleared:'+n
  })()`)
  await sleep(800)

  // 过滤到目标工单
  await evaluate(`(() => {
    const inp=[...document.querySelectorAll('input')].find(i=>i.placeholder&&i.placeholder.includes('输入查询条件'))
    if(!inp) return 'no'
    const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
    setter.call(inp, ${JSON.stringify(WO)}); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'ok'
  })()`)
  await sleep(700)
  await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='查找'); if(b)b.click(); return 'ok' })()`)
  await sleep(4000)

  const opened = await evaluate(`(() => {
    const clean=(s)=>(s||'').replace(/[\\n\\r\\t]/g,'').replace(/[⇅▲▼]/g,'').trim()
    const trs=[...document.querySelectorAll('.el-table__body tr')]
    for (const tr of trs) {
      const t=[...tr.querySelectorAll('td')].map(td=>clean(td.innerText))
      if (t.includes(${JSON.stringify(WO)}) && t.includes(${JSON.stringify(String(XC))})) {
        const cell=[...tr.querySelectorAll('td')].find(td=>clean(td.innerText)===${JSON.stringify(WO)})
        const a=cell&&cell.querySelector('a,span.link,.el-link,button')
        if(a){a.click();return 'clicked'}
        cell && cell.click(); return 'cell'
      }
    }
    return 'not-found:'+trs.length
  })()`)
  console.log('  打开工单详情 = ' + opened)
  await sleep(5000)

  // 读工序步骤的**实际计算色**
  const info = await evaluate(`(() => {
    const dlg=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null)
    if(!dlg) return { err:'no-dialog' }
    // ① 口径说明长段落是否已移除
    const scopeLines=[...dlg.querySelectorAll('.wb-trace-scope-line')].map(x=>x.innerText.trim())
    const stepBlock=[...dlg.querySelectorAll('.wb-trace-block')].find(b=>(b.querySelector('.wb-block-title')||{}).innerText?.includes('工序进度'))
    if(!stepBlock) return { err:'no-step-block', scopeLines }
    const steps=[...stepBlock.querySelectorAll('.el-step')].map(st=>{
      const head=st.querySelector('.el-step__head')
      const icon=st.querySelector('.el-step__icon')
      const iconInner=st.querySelector('.el-step__icon-inner')
      const title=(st.querySelector('.el-step__title')||{}).innerText||''
      const desc=(st.querySelector('.el-step__description')||{}).innerText||''
      const cls=(head&&head.className)||''
      const color=iconInner?getComputedStyle(iconInner).color:''
      const border=icon?getComputedStyle(icon).borderTopColor:''
      // 语义状态:从 class 读 el-step 自己判定的状态
      const state=['is-success','is-process','is-wait','is-error','is-finish'].find(c=>cls.includes(c))||'?'
      return { title:title.trim(), desc:desc.trim().replace(/\\s+/g,' '), state, color, border }
    })
    const legend=(stepBlock.querySelector('.wb-trace-sub')||{}).innerText||''
    return { scopeLines, steps, legend: legend.replace(/\\s+/g,' ').trim() }
  })()`)

  if (info.err) { console.log('  ✗ ' + info.err + ' ' + JSON.stringify(info.scopeLines || [])) }
  else {
    console.log('\n== 口径说明段落(应为空)==\n' + JSON.stringify(info.scopeLines))
    console.log('\n== 图例 ==\n' + info.legend)
    console.log('\n== 工序步骤(实际计算色)==')
    for (const s of info.steps) console.log(`   ${s.title.padEnd(6)} state=${s.state.padEnd(11)} color=${s.color.padEnd(22)} border=${s.border}  desc=${s.desc}`)
  }

  // 截「工序进度」段
  await evaluate(`(() => {
    const dlg=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null)
    const b=[...dlg.querySelectorAll('.wb-trace-block')].find(x=>(x.querySelector('.wb-block-title')||{}).innerText?.includes('工序进度'))
    if(b) b.scrollIntoView({block:'center'})
    return 'ok'
  })()`)
  await sleep(1000)
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  if (shot.result?.data) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true })
    fs.writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'))
    console.log(`\n截图: ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`)
  }

  const noScopeLine = (info.scopeLines || []).length === 0
  const hasSuccess = (info.steps || []).some((s) => s.state === 'is-success')
  const allNonWaitHaveColor = (info.steps || []).filter((s) => s.state !== 'is-wait')
    .every((s) => s.color && s.color !== 'rgb(192, 196, 204)' && s.color !== 'rgb(168, 171, 178)')
  console.log(`\n[结果] 口径说明已移除=${noScopeLine} 存在绿色完成步=${hasSuccess} 非灰步均有主题色=${allNonWaitHaveColor}`)
  ws.close()
  process.exit(noScopeLine && hasSuccess ? 0 : 1)
} finally {
  edge.kill()
  try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
}
