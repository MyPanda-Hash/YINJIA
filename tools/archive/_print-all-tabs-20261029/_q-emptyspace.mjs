/**
 * _q-emptyspace.mjs —— 找出「纸张右侧大片空白」的具体位置
 * 用法: node _q-emptyspace.mjs [base] [panelCode ...]
 *
 * 用户口径(2026-10-29):「过宽的可以把表格适当收窄,因为有一些表格内容不多,
 *   但是占用了大部分的空白」。
 *
 * 判据:对每张表,逐列统计**所有行里出现过的非空文字的最大宽度**。
 *   若某列"配了 N px,但全表该列最长文字只有 M px"(M << N),这列就是白占。
 *   注意:空白录入行(表里没有任何数据的行)不算 —— 那些是为填表预留的,不能收。
 *   所以本脚本**只统计已有数据的行**。
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

const MEASURE = `(() => {
  const tw = (el) => {
    if (!el) return 0
    const r = document.createRange(); r.selectNodeContents(el)
    let w = 0
    for (const rc of r.getClientRects()) w = Math.max(w, rc.width)
    return Math.ceil(w)
  }
  const res = []
  const tables = [...document.querySelectorAll('table.rs-t')].filter(x => x.getClientRects().length)
  for (const [ti, tb] of tables.entries()) {
    const cols = [...tb.querySelectorAll('col')].map(c => parseInt(c.style.width) || 0)
    if (cols.length < 2) continue
    const perCol = Array.from({ length: cols.length }, () => ({ maxText: 0, nonEmptyRows: 0, sample: '' }))
    const rows = [...tb.querySelectorAll('tr')]
    // 跳过第 0 行(报告头/章节条,常是蹇列合并)
    for (const tr of rows.slice(1)) {
      let ci = 0
      let rowHasContent = false
      const cells = [...tr.children]
      // 先判断这一行有没有真实内容(排除只有按钮/占位的行)
      const rowText = cells.map(td => (td.textContent || '').replace(/\\s+/g, ' ').trim()).join('')
      if (!rowText || rowText.length < 2) continue
      for (const td of cells) {
        const span = td.colSpan || 1
        if (span === 1 && ci < cols.length) {
          const label = (td.textContent || '').replace(/\\s+/g, ' ').trim()
          // 只认真实文字(排除纯符号占位 /、—、+)
          if (label && !/^[\\/\\-—+×\\s]+$/.test(label)) {
            const w = tw(td)
            if (w > perCol[ci].maxText) { perCol[ci].maxText = w; perCol[ci].sample = label.slice(0, 14) }
          }
        }
        ci += span
      }
    }
    res.push({
      ti, nCols: cols.length,
      width: Math.max(tb.scrollWidth, tb.offsetWidth),
      cells: perCol.map((c, i) => ({ i, w: cols[i], textW: c.maxText,
        need: c.maxText + 18, waste: cols[i] - (c.maxText + 18), sample: c.sample })),
    })
  }
  return res
})()`

const s = await launch({ port: 9480 })
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
      console.log(`  表${t.ti} ${t.nCols}列 宽${t.width}  配置${sumW}  按文字需要${sumNeed}  可收${sumW - sumNeed}`)
      for (const c of t.cells) {
        if (c.waste > 40) {
          console.log(`     列${String(c.i).padStart(2)} 配${String(c.w).padStart(4)} / 文字${String(c.textW).padStart(3)} ⇒ 白占${String(c.waste).padStart(4)}  「${c.sample}」`)
        }
      }
    }
  }
  await fs.writeFile(new URL('./out-emptyspace.json', import.meta.url), JSON.stringify(report, null, 2), 'utf8')
} finally {
  process.exit(0)
}
