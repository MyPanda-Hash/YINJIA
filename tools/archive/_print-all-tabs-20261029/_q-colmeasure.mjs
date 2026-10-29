/**
 * _q-colmeasure.mjs —— 逐个面板量**每一列的表头文字实际宽度**,找出「宽列但内容短」的空列
 * 用法: node _q-colmeasure.mjs [base] [panelCode ...]
 *
 * 用户口径(2026-10-29):「过宽的可以把表格适当收窄,因为有一些表格内容不多,
 *   但是占用了大部分的空白,调整完之后再给原生打印也加等比缩放」。
 *
 * 判据:一列的实际需要宽度 ≈ max(表头文字宽, 该列最长的数据文字宽) + 内边距。
 *   配置里给的 px 远大于这个值 ⇒ 白占宽度,可以收。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
const fs = await import('node:fs/promises')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const PANELS = process.argv.slice(3)

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const token = (await lr.json())?.data?.token || ''
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }

async function firstNo(p) {
  const r = await (await fetch(BASE + '/api/px/queryFormDataList', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: p, pageNo: 1, pageSize: 1, condition: {} }),
  })).json()
  const row = (r?.data?.list || [])[0] || {}
  return String(row['单据编号'] || row['编号'] || '')
}

const LOGIN_JS = `(() => {
  const ph=(p)=>[...document.querySelectorAll('input')].find(i=>(i.placeholder||'').includes(p))
  const set=(el,v)=>{if(!el)return false;el.focus();const d=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');d&&d.set?d.set.call(el,v):(el.value=v);el.dispatchEvent(new Event('input',{bubbles:true}));return true}
  set(ph('登录账号')||ph('账号'),'admin');set(ph('登录密码')||ph('密码'),'123456')
  const b=document.querySelector('.login-submit');b&&b.click();return 'ok'
})()`

/** 在页面里量:每个可见 .rs-t 的每列 = {配置宽, 表头文字宽, 最长内容文字宽} */
const MEASURE = `(() => {
  const cv = document.createElement('canvas')
  const ctx = cv.getContext('2d')
  const textW = (txt, font) => { ctx.font = font; return Math.ceil(ctx.measureText(String(txt||'')).width) }
  const out = []
  const tables = [...document.querySelectorAll('.rs-t')].filter(x => x.getClientRects().length)
  for (const tb of tables) {
    const cols = [...tb.querySelectorAll('col')].map(c => parseInt(c.style.width) || 0)
    const cs = getComputedStyle(tb)
    const font = cs.fontSize + ' ' + cs.fontFamily
    const rows = [...tb.querySelectorAll('tr')]
    if (!rows.length) continue
    const head = rows[0]
    const header = [...head.children].map(td => (td.textContent||'').replace(/\\s+/g,' ').trim())
    const bodyCells = rows.slice(1).map(tr => [...tr.children].map(td => (td.textContent||'').replace(/\\s+/g,' ').trim()))
    const cells = []
    // 逐列(按 colgroup 位置;colspan 简单按顺序铺)
    let ci = 0
    for (const td of head.children) {
      const span = td.colSpan || 1
      const w = cols.slice(ci, ci + span).reduce((a,b)=>a+b,0)
      const htxt = (td.textContent||'').replace(/\\s+/g,' ').trim()
      let maxBody = 0
      for (const br of bodyCells) {
        for (let k = ci; k < ci + span && k < br.length; k++) maxBody = Math.max(maxBody, textW(br[k], font))
      }
      cells.push({ i: ci, span, w, head: htxt, headW: textW(htxt, font), bodyW: maxBody,
                   need: Math.max(textW(htxt, font), maxBody) + 16 })
      ci += span
    }
    out.push({ width: Math.max(tb.scrollWidth, tb.offsetWidth), cells })
  }
  return out
})()`

const s = await launch({ port: 9478 })
const report = []
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1800, height: 1200, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(5000)

  for (const p of PANELS) {
    const no = await firstNo(p)
    await s.navigate(`${BASE}/#/panelx/list/${p}${no ? '?docNo=' + encodeURIComponent(no) : ''}`)
    for (let i = 0; i < 10; i++) {
      await sleep(1800)
      if (await s.evaluate(`!!document.querySelector('.rs-t')`)) break
    }
    const m = await s.evaluate(MEASURE)
    report.push({ panel: p, tables: m })
    console.log('\n==== ' + p + ' ====')
    for (const [ti, t] of m.entries()) {
      const sumW = t.cells.reduce((a,c)=>a+c.w,0)
      const sumNeed = t.cells.reduce((a,c)=>a+c.need,0)
      console.log(`  表${ti}  宽 ${t.width}px  |  各列配置合计 ${sumW}  |  实际需要 ${sumNeed}  |  可收 ${sumW - sumNeed}px`)
      for (const c of t.cells) {
        const waste = c.w - c.need
        if (waste > 25) console.log(`      列${c.i} 「${c.head}」 配 ${c.w}px / 需 ${c.need}px  ⇒ 白占 ${waste}px`)
      }
    }
  }
  await fs.writeFile(new URL('./out-colmeasure.json', import.meta.url), JSON.stringify(report, null, 2), 'utf8')
} finally {
  process.exit(0)
}
