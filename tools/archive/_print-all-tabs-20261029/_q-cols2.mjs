/**
 * _q-cols2.mjs —— 准确量「哪些列配得太宽、白占空白」
 * 用法: node _q-cols2.mjs [base] [panelCode ...]
 *
 * 上一版的问题:报告头/章节条那种 colspan=整行的单元格被当成"列0配 1228px",
 *   得出"可收 1159px"的假结论。本版只分析**数据表**(.rsp-dt-table)与
 *   有多列的 .rs-t,并且按 colgroup 逐列真实量:取样该列所有 td 的文字宽度。
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

/**
 * 逐列量:对每个有 colgroup 且列数>1 的表,按 [css 列 → 该列出现的所有单元格文字] 统计。
 * 用 Range 量文字真实渲染宽度(比 canvas 更准:含字间距/字体回退)。
 */
const MEASURE = `(() => {
  const tw = (el) => {
    if (!el) return 0
    const r = document.createRange()
    r.selectNodeContents(el)
    const rects = r.getClientRects()
    let w = 0
    for (const rc of rects) w = Math.max(w, rc.width)
    return Math.ceil(w)
  }
  const out = []
  const tables = [...document.querySelectorAll('table.rs-t, table.rsp-dt-table')].filter(x => x.getClientRects().length)
  for (const [ti, tb] of tables.entries()) {
    const cols = [...tb.querySelectorAll('col')].map(c => parseInt(c.style.width) || 0)
    if (cols.length < 2) continue
    // 按列位置收集文字宽度:遍历所有行,按 td 顺序 + colspan 摊到列上
    const perCol = Array.from({ length: cols.length }, () => [])
    const rows = [...tb.querySelectorAll('tr')]
    for (const tr of rows) {
      let ci = 0
      for (const td of tr.children) {
        const span = td.colSpan || 1
        if (span === 1 && ci < cols.length) {
          const label = (td.textContent || '').replace(/\\s+/g, ' ').trim()
          if (label) perCol[ci].push({ w: tw(td), label: label.slice(0, 12) })
        }
        ci += span
      }
    }
    const cells = perCol.map((arr, i) => {
      const maxW = arr.length ? Math.max(...arr.map(a => a.w)) : 0
      const longest = arr.slice().sort((a, b) => b.w - a.w)[0]
      return { i, w: cols[i], maxTextW: maxW, need: maxW + 18, waste: cols[i] - (maxW + 18),
               sample: longest ? longest.label : '' }
    })
    out.push({ ti, width: Math.max(tb.scrollWidth, tb.offsetWidth), nCols: cols.length, cells })
  }
  return out
})()`

const s = await launch({ port: 9479 })
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
      if (await s.evaluate(`!!document.querySelector('table.rs-t')`)) break
    }
    const m = await s.evaluate(MEASURE)
    report.push({ panel: p, tables: m })
    console.log('\n==== ' + p + ' ====')
    for (const t of m) {
      const sumW = t.cells.reduce((a, c) => a + c.w, 0)
      const sumNeed = t.cells.reduce((a, c) => a + Math.min(c.w, c.need), 0)
      console.log(`  表${t.ti} ${t.nCols}列  宽 ${t.width}px  配置合计 ${sumW}  可收 ${sumW - sumNeed}px`)
      for (const c of t.cells) {
        if (c.waste > 30) {
          console.log(`      列${c.i} 配 ${String(c.w).padStart(4)}px / 文字 ${String(c.maxTextW).padStart(4)}px  ⇒ 白占 ${String(c.waste).padStart(4)}px   「${c.sample}」`)
        }
      }
    }
  }
  await fs.writeFile(new URL('./out-cols2.json', import.meta.url), JSON.stringify(report, null, 2), 'utf8')
} finally {
  process.exit(0)
}
