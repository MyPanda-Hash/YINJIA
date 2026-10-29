/**
 * _q-overflow.mjs —— 在**打印媒体**下量每张纸是否横向溢出 A4 内容宽(会不会被裁掉)
 * 用法: node _q-overflow.mjs [base] [panelCode]
 *
 * 为什么换证据:Page.printToPDF 在本机 CDP 上不返回数据(静默失败)。
 * 改用 CSS 层面可验证的事实:
 *   ① 打印样式只把 .rsp-sheet 设成 width:100% + zoom:0.92,
 *      内层 <table class="rs-t"> 的宽度是**行内 px**(secW(sec) = 网格列宽之和);
 *   ② A4 竖向在 8mm 边距下内容宽 ≈ 733px,× zoom 0.92 之后等效可容纳 ≈ 797px;
 *   ③ 所以 纸宽(px) × 0.92 > 733 ⇒ 表格比纸宽 ⇒ 右侧被裁。
 * 本脚本在真实页面里加 approval-printing 类,量「纸张内容盒宽」与「每张表的 scrollWidth」,
 * 直接给出溢出量(px),不靠推算。
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

/** A4 竖向 210mm - 8mm×2 边距 = 194mm;96dpi ⇒ 194/25.4*96 ≈ 733px */
const A4_CONTENT_PX = Math.round((210 - 16) / 25.4 * 96)
const ZOOM = 0.92

const s = await launch({ port: 9477 })
const rows = []
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1800, height: 1200, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(5000)

  for (const p of PANELS) {
    const no = await firstNo(p)
    await s.navigate(`${BASE}/#/panelx/list/${p}${no ? '?docNo=' + encodeURIComponent(no) : ''}`)
    for (let i = 0; i < 10; i++) {
      await sleep(1800)
      if (await s.evaluate(`!!document.querySelector('.record-sheet')`)) break
    }
    // 加打印类,量打印媒体下的真实布局
    const g = await s.evaluate(`(() => {
      document.body.classList.add('approval-printing')
      // 强制重排,让打印样式生效
      void document.body.offsetWidth
      const sheets = [...document.querySelectorAll('.rsp-sheet')]
      const tables = [...document.querySelectorAll('.rs-t')].filter(x => x.offsetParent !== null || x.getClientRects().length)
      const sheetW = sheets.length ? Math.max(...sheets.map(x => x.scrollWidth)) : 0
      const tableW = tables.length ? Math.max(...tables.map(x => x.scrollWidth)) : 0
      const res = { sheetW, tableW, nTables: tables.length }
      document.body.classList.remove('approval-printing')
      return res
    })()`)
    const eff = Math.round(g.tableW * ZOOM)
    rows.push({ panel: p, no, ...g, eff, overflow: eff - A4_CONTENT_PX })
    console.log(p.padEnd(18), '表格', String(g.tableW).padStart(5) + 'px',
      '→×0.92=', String(eff).padStart(5), '| A4 可容', A4_CONTENT_PX,
      '| 溢出', String(eff - A4_CONTENT_PX).padStart(5) + 'px',
      (eff > A4_CONTENT_PX ? '  ❌ 会被裁' : '  ✅ 可容纳'))
  }
  await fs.writeFile(new URL('./out-overflow.json', import.meta.url), JSON.stringify(rows, null, 2), 'utf8')
  const bad = rows.filter(r => r.overflow > 0)
  console.log('\n需要处理 =', bad.length, '/', rows.length)
} finally {
  process.exit(0)
}
