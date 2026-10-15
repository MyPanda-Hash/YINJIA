/**
 * 探针(界面):概览五项优化的验收(2026-10-15)
 * A 口径统一  B 趋势空态说明  C 事件流接上数据 + 下拉占位符走 tt()  D 去重  E 微条聚合口径
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const BASE = 'http://127.0.0.1:8090'
const API = BASE + '/api'
const PORT = 9361
const OUT = path.join(process.env.TEMP, 'mes-overview')
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const chk = (id, name, ok, detail) => {
  console.log(`  ${ok ? '\u2713' : '\u2717'} [${id}] ${name}${detail === undefined ? '' : '  → ' + detail}`)
  if (!ok) fails++
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const lr = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })
  const lj = await lr.json()
  const tok = lj?.data?.token, user = lj?.data?.user
  if (!tok) throw new Error('登录失败')

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ov2-'))
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1440,1400', 'about:blank'], { stdio: 'ignore' })
  try {
    let target = null
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(300)
      try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page') } catch {}
    }
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let id = 0; const pend = new Map(); const errs = []
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push((m.params.args || []).map((a) => a.value || a.description).join(' ').slice(0, 140))
    }
    const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
    const ev = async (x) => {
      const r = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })
      if (r.result && r.result.exceptionDetails) return '[JS异常] ' + r.result.exceptionDetails.text
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2000)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(tok)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-10-15'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
    await send('Page.navigate', { url: BASE + '/#/dashboard' }); await sleep(5800)
    await ev(`(() => { const s=document.querySelector('.wz-skip'); if(s) s.click(); return 'x' })()`)
    await sleep(2200)

    const info = await ev(`(() => {
      const cards=[...document.querySelectorAll('.dashboard .card')]
      const kpi=cards.filter(c=>c.classList.contains('live-metric')).map(c=>({
        title:(c.querySelector('.metric-label')||{}).innerText||'',
        value:(c.querySelector('.metric-reading strong')||{}).innerText||'',
        foot:(c.querySelector('.metric-foot')||{}).innerText.replace(/\\s+/g,' ').trim()||'',
        bars:c.querySelectorAll('.micro-bars i').length }))
      const trend=cards.find(c=>c.querySelector('.sline')||c.querySelector('.trend-empty'))
      const ev=cards.find(c=>c.querySelector('.event-list'))
      const pick=cards.find(c=>c.querySelector('.flow-pick'))
      // 直接取整个下拉的可见文本 —— 不能用 .el-select__placeholder(会取到空元素导致假通过)
      const pickText = pick ? (pick.querySelector('.flow-pick')||{}).innerText.replace(/\s+/g,' ').trim() : ''
      const pickHtml = pick ? ((pick.querySelector('.flow-pick')||{}).innerHTML||'').slice(0,160) : ''
      return {
        kpi,
        trendHasLine: !!trend?.querySelector('polyline'),
        trendText: trend?((trend.querySelector('.trend-empty')||{}).innerText||'').replace(/\\s+/g,' ').trim():'',
        eventRows: ev?ev.querySelectorAll('.event-row').length:0,
        eventEmpty: ev?!!ev.querySelector('.event-list > .empty'):false,
        eventText: ev?[...ev.querySelectorAll('.event-row')].slice(0,2).map(r=>r.innerText.replace(/\\s+/g,' ').trim()):[],
        pickText, pickHtml,
      }
    })()`)
    console.log('  [KPI] ' + JSON.stringify(info.kpi.map((k) => `${k.title}=${k.value}(${k.foot})`)))
    console.log('  [趋势] line=' + info.trendHasLine + ' text=' + JSON.stringify(info.trendText))
    console.log('  [事件流] rows=' + info.eventRows + ' empty=' + info.eventEmpty + ' 前两条=' + JSON.stringify(info.eventText))
    console.log('  [下拉] ' + JSON.stringify(info.pickText))

    const k1 = info.kpi[0] || {}, k2 = info.kpi[1] || {}
    chk('A1', '①「生产任务负载」脚注不再是「总计 0 单」', !/总计\s*0\s*单/.test(k1.foot), k1.foot)
    chk('A2', '① 卡内自洽:主值(在产) 与 脚注(总计) 同源同量级', k1.value === '25' && /总计\s*25/.test(k1.foot), `${k1.value} / ${k1.foot}`)
    chk('D1', '④ KPI 行不再有重复的「工单闭环率」卡', k2.title === '已完工工单', k2.title)
    chk('D2', '④ 闭环率降级为辅助文案(仍在,但不占卡片主位)', /闭环率/.test(k2.foot), k2.foot)
    chk('D3', '④ 闭环率分母已修正(meta 不再是 0 / 0)', /0\s*\/\s*25/.test(k2.foot), k2.foot)
    chk('B1', '② 近 7 天全 0 时不再画一条贴底直线,改空态', info.trendHasLine === false)
    chk('B2', '② 空态说明了原因与数据截止日', /无新增或完工/.test(info.trendText) && /2026-08-26/.test(info.trendText), info.trendText)
    chk('C1', '③ 事件流真的有数据了(不再是死卡片)', info.eventRows > 0 && !info.eventEmpty, `${info.eventRows} 行`)
    chk('C2', '③ 事件行含面板名/单号/时间', info.eventText.length > 0 && /\d{2}-\d{2}\s\d{2}:\d{2}/.test(info.eventText[0] || ''), JSON.stringify(info.eventText[0]))
    chk('C3', '③ 下拉显示「全部事件」而不是 Element Plus 默认「请选择」',
      info.pickText === '全部事件', `text=${JSON.stringify(info.pickText)} html=${JSON.stringify(info.pickHtml)}`)
    chk('E1', '⑤ 销售卡微条已改用聚合口径(片数 = TOP6+未填+其它 = 8)',
      info.kpi[3] && info.kpi[3].bars === 8, `bars=${info.kpi[3]?.bars}`)
    chk('V0', '无 console 报错', errs.length === 0, JSON.stringify(errs))

    const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
    fs.writeFileSync(path.join(OUT, 'overview-after.png'), Buffer.from(s.result.data, 'base64'))
    console.log('  shot → ' + path.join(OUT, 'overview-after.png'))
    ws.close()
  } finally { edge.kill() }

  console.log('')
  if (fails === 0) console.log('[PASS] 概览五项优化全部生效')
  else { console.log(`[FAIL] ${fails} 项不符`); process.exit(1) }
}
main().catch((e) => { console.error('FATAL ' + e.message); process.exit(1) })
