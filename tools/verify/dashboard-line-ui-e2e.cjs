/**
 * 探针(界面):折线趋势图「两条线能不能分清楚」(2026-10-15 用户报"分不出哪条线代表什么")
 * 断言:① 两条线颜色不同且明度拉开 ② 图例在**顶部**、含名称 + 最新值
 *      ③ 图例画出了线型(实线块 / 虚线块) ④ X 轴抽稀 ⑤ 峰值描边不再与序列撞色
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const BASE = 'http://127.0.0.1:8090'
const API = BASE + '/api'
const PORT = 9361
const OUT = path.join(process.env.TEMP, 'mes-line')
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const chk = (id, name, ok, detail) => {
  console.log(`  ${ok ? '\u2713' : '\u2717'} [${id}] ${name}${detail === undefined ? '' : '  → ' + detail}`)
  if (!ok) fails++
}
/** 相对亮度(WCAG 口径),用来判"两个颜色是不是明度太接近"。接受 #rrggbb 或 rgb(r,g,b) */
const lum = (col) => {
  const s = String(col || '')
  let rgb
  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (m) rgb = [m[1], m[2], m[3]].map(Number)
  else {
    const c = s.replace('#', '')
    rgb = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16))
  }
  const v = rgb.map((x) => x / 255).map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)))
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
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

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'line-'))
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

    const info = await ev(`(() => {
      const card = [...document.querySelectorAll('.dashboard .card')].find(c => ((c.querySelector('.card-title')||{}).innerText||'').includes('趋势'))
      if (!card) return null
      const lines = [...card.querySelectorAll('polyline')].map(p => ({ stroke: p.getAttribute('stroke'), style: getComputedStyle(p).stroke, dash: getComputedStyle(p).strokeDasharray }))
      const legend = card.querySelector('.line-legend')
      const chips = [...card.querySelectorAll('.lg-chip')].map(c => ({ dashed: c.classList.contains('dashed'), bg: getComputedStyle(c).backgroundColor, bgImage: getComputedStyle(c).backgroundImage.slice(0, 60) }))
      const peak = card.querySelector('circle.peak')
      return {
        cardTitle: (card.querySelector('.card-title')||{}).innerText.trim(),
        lines, chips,
        legendText: legend ? legend.innerText.replace(/\\s+/g,' ').trim() : '',
        legendAboveChart: legend ? (legend.getBoundingClientRect().top < card.querySelector('svg').getBoundingClientRect().top) : false,
        xLabels: [...card.querySelectorAll('.line-x .lx')].map(e=>e.innerText),
        peakStroke: peak ? getComputedStyle(peak).stroke : null,
        hasLastVal: !!card.querySelector('.last-val'),
      }
    })()`)
    console.log('  [现状] ' + JSON.stringify({ lines: info.lines.map((l) => l.style), chips: info.chips.map((c) => c.dashed ? '虚线块' : '实线块'), 图例: info.legendText, 图例在图表上方: info.legendAboveChart, x标签: info.xLabels.length, 峰值描边: info.peakStroke }))

    const ca = info.lines[0]?.style || '', cb = info.lines[1]?.style || ''
    chk('L1', '两条折线颜色不同', ca !== cb && ca && cb, `${ca} / ${cb}`)
    chk('L2', '两条线明度拉开(相对亮度差 > 0.12,不再是两个深色叠一起)',
      Math.abs(lum(ca) - lum(cb)) > 0.12, `Δlum=${Math.abs(lum(ca) - lum(cb)).toFixed(3)}`)
    chk('L3', '图例在图表**上方**(视线不用来回跳)', info.legendAboveChart === true)
    chk('L4', '图例含两条序列的名称', /新增/.test(info.legendText) && /已审核/.test(info.legendText), info.legendText)
    chk('L5', '图例含两条序列的**最新值**', /新增\s*\d+/.test(info.legendText) && /已审核\s*\d+/.test(info.legendText), info.legendText)
    chk('L6', '图例画出线型:一个实线块 + 一个虚线块',
      info.chips.length === 2 && info.chips.some((c) => c.dashed) && info.chips.some((c) => !c.dashed),
      JSON.stringify(info.chips.map((c) => ({ dashed: c.dashed, img: !!c.bgImage && c.bgImage !== 'none' }))))
    chk('L7', 'X 轴标签抽稀(≤ 8)', info.xLabels.length > 0 && info.xLabels.length <= 8, info.xLabels.length + ' 个')
    chk('L8', '峰值描边不再与两条序列撞色(#b94d3f 砖红)',
      info.peakStroke && info.peakStroke !== ca && info.peakStroke !== cb, info.peakStroke)
    chk('L9', '移除被 preserveAspectRatio 拉伸的 SVG 末点文本', info.hasLastVal === false)
    chk('L10', '无 console 报错', errs.length === 0, JSON.stringify(errs))

    const card = await ev(`(() => { const c=[...document.querySelectorAll('.dashboard .card')].find(c=>((c.querySelector('.card-title')||{}).innerText||'').includes('趋势')); const r=c.getBoundingClientRect(); return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)} })()`)
    const s = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, clip: { x: card.x, y: card.y, width: card.w, height: card.h, scale: 1 } })
    fs.writeFileSync(path.join(OUT, 'trend.png'), Buffer.from(s.result.data, 'base64'))
    console.log('  shot → ' + path.join(OUT, 'trend.png'))

    // ── 共用组件回归:SLine 也被 生产/库存/质量 用着,确认没把它们弄坏 ──
    for (const tab of ['生产', '库存', '质量']) {
      const ti = tabs.findIndex((t) => t.indexOf(tab) >= 0)
      if (ti < 0) continue
      await ev(`(() => { const t=document.querySelectorAll('.mod-tab')[${ti}]; if(t) t.click(); return 'ok' })()`)
      await sleep(2600)
      const r = await ev(`(() => {
        const c=[...document.querySelectorAll('.dashboard .card')].find(c=>c.querySelector('.sline'))
        if(!c) return { tab: ${JSON.stringify(tab)}, none: true }
        const lines=[...c.querySelectorAll('polyline')].map(p=>getComputedStyle(p).stroke)
        const lg=c.querySelector('.line-legend')
        return { tab: ${JSON.stringify(tab)}, title:(c.querySelector('.card-title')||{}).innerText.trim(), lines,
                 legend: lg?lg.innerText.replace(/\\s+/g,' ').trim():'', chips:c.querySelectorAll('.lg-chip').length,
                 x:c.querySelectorAll('.line-x .lx').length }
      })()`)
      chk('R-' + tab, `${tab} 页签的趋势图仍正常(共用 SLine)`,
        !r.none && r.lines.length === 2 && r.chips === 2 && r.legend.length > 0, JSON.stringify(r))
    }
    ws.close()
  } finally { edge.kill() }

  console.log('')
  if (fails === 0) console.log('[PASS] 趋势图两条线可分辨(颜色/线型/图例齐备)')
  else { console.log(`[FAIL] ${fails} 项不符`); process.exit(1) }
}
main().catch((e) => { console.error('FATAL ' + e.message); process.exit(1) })
