/**
 * 探针(界面):我的桌面 → 销售 页签 的展示完整度(2026-10-15 五项改进验收)
 * ① 金额 KPI 走 formatCompact ② 趋势=近 30 天且标签抽稀 ③ 甜甜圈合计=335
 * ④ 两个排行各可切「订单数/数量 ↔ 金额」 ⑤ 产品标签列宽 120px
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const BASE = 'http://127.0.0.1:8090'
const API = BASE + '/api'
const PORT = 9361
const OUT = path.join(process.env.TEMP, 'mes-sales-dash')
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

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sales2-'))
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1440,1100', 'about:blank'], { stdio: 'ignore' })
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
    const shot = async (n) => {
      const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
      fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from(s.result.data, 'base64'))
      console.log('  shot → ' + path.join(OUT, n + '.png'))
    }
    // 按卡片标题取卡(标题里含关键字)
    const CARD = (kw) => `[...document.querySelectorAll('.dashboard .card')].find(c => ((c.querySelector('.card-title')||{}).innerText||'').includes(${JSON.stringify(kw)}))`
    const SNAP = `(() => {
      const cards=[...document.querySelectorAll('.dashboard .card')]
      const kpi=cards.filter(c=>c.classList.contains('metric-card')).map(c=>({t:(c.querySelector('.kpi-title')||{}).innerText,v:(c.querySelector('.kpi-num')||{}).innerText}))
      const donut=cards.find(c=>c.querySelector('.sdonut'))
      const trend=cards.find(c=>c.querySelector('.sline'))
      const prod=cards.find(c=>((c.querySelector('.card-title')||{}).innerText||'').includes('TOP 产品'))
      const lbl=prod?prod.querySelector('.bar-label'):null
      return {
        kpi,
        donutTitle: donut?((donut.querySelector('.card-title')||{}).innerText||'').trim():'',
        donutCenter: donut?((donut.querySelector('.donut-total')||{}).innerText||''):'',
        donutSub: donut?((donut.querySelector('.donut-sub')||{}).innerText||''):'',
        donutSlices: donut?[...donut.querySelectorAll('.lg-item .lg-name')].map(e=>e.innerText):[],
        trendTitle: trend?((trend.querySelector('.card-title')||{}).innerText||'').trim():'',
        trendXLabels: trend?[...trend.querySelectorAll('.line-x .lx')].map(e=>e.innerText):[],
        prodTitle: prod?((prod.querySelector('.card-title')||{}).innerText||'').trim():'',
        prodLabelW: lbl?Math.round(lbl.getBoundingClientRect().width):0,
        prodFirst: prod?((prod.querySelector('.bar-row .bar-label')||{}).innerText||''):'',
      }
    })()`
    const clickSeg = (kw, text) => `(() => {
      const c = ${CARD(kw)}; if(!c) return 'no-card'
      const b = [...c.querySelectorAll('.el-radio-button')].find(x => x.innerText.trim() === ${JSON.stringify(text)})
      if(!b) return 'no-btn:' + [...c.querySelectorAll('.el-radio-button')].map(x=>x.innerText.trim()).join('/')
      b.click(); return 'clicked'
    })()`

    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2000)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(tok)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-10-15'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
    await send('Page.navigate', { url: BASE + '/#/dashboard' }); await sleep(5200)
    await ev(`(() => { const s=document.querySelector('.wz-skip'); if(s) s.click(); return 'x' })()`)
    await sleep(1000)
    const tabs = await ev(`[...document.querySelectorAll('.mod-tab')].map(e=>e.innerText.trim())`)
    const si = tabs.findIndex((t) => t.indexOf('销售') >= 0)
    await ev(`(() => { const t=document.querySelectorAll('.mod-tab')[${si}]; if(t) t.click(); return 'ok' })()`)
    await sleep(3000)

    const a = await ev(SNAP)
    console.log('  [默认态] ' + JSON.stringify({ kpi: a.kpi, donut: a.donutTitle + ' / 中心 ' + a.donutCenter + ' ' + a.donutSub, trend: a.trendTitle + ' / ' + a.trendXLabels.length + ' 个标签', prod: a.prodTitle + ' / 标签宽 ' + a.prodLabelW }))

    const amtKpi = (a.kpi.find((k) => k.t.indexOf('金额') >= 0) || {}).v || ''
    chk('V1', '① 金额 KPI 已格式化(不是 17630591.27 裸数字)', amtKpi !== '17630591.27' && /万|,/.test(amtKpi), amtKpi)
    chk('V2', '② 趋势卡片标题 = 近 30 天订单趋势', a.trendTitle.includes('近 30 天'), a.trendTitle)
    chk('V3', '② 30 个点的 X 轴标签已抽稀(≤ 8 个)', a.trendXLabels.length > 0 && a.trendXLabels.length <= 8, a.trendXLabels.length + ' 个: ' + JSON.stringify(a.trendXLabels))
    chk('V4', '③ 甜甜圈中心 = 订单总数 335(不再只算 TOP6 的 98)', a.donutCenter === '335', a.donutCenter)
    chk('V5', '③ 甜甜圈含聚合片(其它 / 未填客户)', a.donutSlices.some((n) => n === '其它' || n === '未填客户'), JSON.stringify(a.donutSlices))
    chk('V6', '⑤ 产品标签列宽已放宽到 120px', a.prodLabelW >= 110, a.prodLabelW + 'px')
    await shot('01-count')

    // ④ 切「金额」
    const c1 = await ev(clickSeg('客户订单分布', '金额'))
    await sleep(1200)
    const b1 = await ev(SNAP)
    chk('V7', '④ 客户分布可切「金额」(中心变成金额,单位=元)',
      c1 === 'clicked' && b1.donutSub === '元' && b1.donutCenter !== '335', `click=${c1} 中心=${b1.donutCenter}${b1.donutSub}`)
    const c2 = await ev(clickSeg('TOP 产品', '金额'))
    await sleep(1200)
    const b2 = await ev(SNAP)
    chk('V8', '④ TOP 产品可切「金额」(标题与数值都跟着变)',
      c2 === 'clicked' && b2.prodTitle.includes('金额'), `click=${c2} 标题=${b2.prodTitle}`)
    // 金额数值不折行 + 标签不截断(2026-10-15 截图实测的两个展示缺陷)
    const wrap = await ev(`(() => {
      const c = ${CARD('TOP 产品')}; if(!c) return null
      const vs=[...c.querySelectorAll('.bar-val')]
      const wrapped=vs.filter(v => v.scrollWidth > v.clientWidth + 1).map(v=>v.innerText)
      const lbls=[...c.querySelectorAll('.bar-label')]
      const cut=lbls.filter(l => l.scrollWidth > l.clientWidth + 1).map(l=>l.innerText)
      return { wrapped, cut, labelW: lbls[0]?Math.round(lbls[0].getBoundingClientRect().width):0 }
    })()`)
    chk('V10', '金额数值不折行(518.4万 这类)', wrap && wrap.wrapped.length === 0, JSON.stringify(wrap?.wrapped))
    chk('V11', '产品名不被截断(标签列 146px)', wrap && wrap.cut.length === 0 && wrap.labelW >= 140,
      `截断=${JSON.stringify(wrap?.cut)} 宽=${wrap?.labelW}`)
    await shot('02-amount')

    console.log('  [console 报错] ' + (errs.length ? JSON.stringify(errs) : '无'))
    chk('V9', '无 console 报错', errs.length === 0)
    ws.close()
  } finally { edge.kill() }

  console.log('')
  if (fails === 0) console.log('[PASS] 销售页签五项展示改进全部生效')
  else { console.log(`[FAIL] ${fails} 项不符`); process.exit(1) }
}
main().catch((e) => { console.error('FATAL ' + e.message); process.exit(1) })
