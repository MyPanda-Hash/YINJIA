/**
 * _q-width-audit.mjs —— 逐个面板量「纸张实际像素宽度」,算出 A4 横向/竖向下的缩放比
 * 用法: node _q-width-audit.mjs [base]
 *
 * 用户口径(2026-10-29):「A. 保持现状,其他的面板的也是这样,看看有哪些打印出来的是过宽的」。
 *   ⇒ 需要一份真实数据:哪些面板的纸面宽度超出 A4 内容宽(733px @8mm 边距),
 *     以及超出的程度(缩放后字号还剩多少)。
 *
 * 为什么不用配置里的 grid 求和:变体网格 / 按页网格 / plain 面板按列宽之和都会影响;
 * 直接量渲染出来的 .record-sheet 的 scrollWidth 才是真的。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
const fs = await import('node:fs/promises')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const out = []
const log = (k, v) => { out.push({ k, v }); console.log(k, '=', typeof v === 'object' ? JSON.stringify(v) : v) }

/** 所有走文书路径的面板(recordSheetConfigs 的键) */
const { recordSheetConfigs } = await import('file:///C:/INCER/YINJIA-MES/frontend/src/core/views/recordSheetConfigs.js')
const PANELS = Object.keys(recordSheetConfigs)

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const token = (await lr.json())?.data?.token || ''
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }

async function firstNo(p) {
  try {
    const r = await (await fetch(BASE + '/api/px/queryFormDataList', {
      method: 'POST', headers: H,
      body: JSON.stringify({ panelCode: p, pageNo: 1, pageSize: 1, condition: {} }),
    })).json()
    const row = (r?.data?.list || [])[0] || {}
    return String(row['单据编号'] || row['编号'] || '')
  } catch { return '' }
}

const LOGIN_JS = `(() => {
  const ph=(p)=>[...document.querySelectorAll('input')].find(i=>(i.placeholder||'').includes(p))
  const set=(el,v)=>{if(!el)return false;el.focus();const d=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');d&&d.set?d.set.call(el,v):(el.value=v);el.dispatchEvent(new Event('input',{bubbles:true}));return true}
  set(ph('登录账号')||ph('账号'),'admin');set(ph('登录密码')||ph('密码'),'123456')
  const b=document.querySelector('.login-submit');b&&b.click();return 'ok'
})()`

const s = await launch({ port: 9475 })
const A4_V = 733   // A4 竖向内容宽 px (210-16mm)
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1800, height: 1200, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(5000)

  const results = []
  for (const p of PANELS) {
    const no = await firstNo(p)
    const q = no ? '?docNo=' + encodeURIComponent(no) : ''
    await s.navigate(`${BASE}/#/panelx/list/${p}${q}`)
    // 等纸面出现(最多 16s)
    let seen = false
    for (let i = 0; i < 8; i++) {
      await sleep(2000)
      seen = await s.evaluate(`!!document.querySelector('.approval-layout .record-sheet, .approval-layout .approval-sheet, .record-sheet')`)
      if (seen) break
    }
    if (!seen) { results.push({ panel: p, no, err: 'no-sheet' }); continue }
    const g = await s.evaluate(`(() => {
      const el = document.querySelector('.approval-layout .record-sheet, .approval-layout .approval-sheet, .record-sheet')
      if (!el) return null
      const tabs = [...document.querySelectorAll('.rsp-page-tab')]
      return {
        w: Math.max(el.scrollWidth, el.offsetWidth),
        h: Math.max(el.scrollHeight, el.offsetHeight),
        tabs: tabs.map(t => (t.textContent||'').trim()),
      }
    })()`)
    if (!g) { results.push({ panel: p, no, err: 'no-el' }); continue }
    results.push({ panel: p, no, w: g.w, h: g.h, tabs: g.tabs.length })
  }

  // 汇总:只有 w > A4_V 的才算过宽
  const over = results.filter(r => r.w && r.w > A4_V).sort((a, b) => b.w - a.w)
  const ok = results.filter(r => r.w && r.w <= A4_V)
  const bad = results.filter(r => r.err)

  console.log('\n===== 过宽面板(纸张 px 宽 > A4 内容宽 ' + A4_V + 'px) =====')
  for (const r of over) {
    console.log(r.panel.padEnd(18), String(r.w).padStart(5) + 'px',
      ' 缩放至 ' + (A4_V / r.w * 100).toFixed(0) + '%',
      ' 页签 ' + r.tabs)
  }
  console.log('\n===== 正常(不需缩放或轻缩) =====')
  for (const r of ok.sort((a, b) => b.w - a.w)) {
    console.log(r.panel.padEnd(18), String(r.w).padStart(5) + 'px',
      ' 缩放至 ' + Math.min(100, A4_V / r.w * 100).toFixed(0) + '%')
  }
  if (bad.length) {
    console.log('\n===== 没取到纸面(无单据或无该面板权限) =====')
    console.log(bad.map(r => r.panel + '(' + (r.err) + ')').join('  '))
  }
  log('汇总', { over: over.length, ok: ok.length, bad: bad.length })
  await fs.writeFile(new URL('./out-width-audit.json', import.meta.url), JSON.stringify(results, null, 2), 'utf8')
} finally {
  process.exit(0)
}
