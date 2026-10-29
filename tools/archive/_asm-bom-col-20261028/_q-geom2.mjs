/**
 * _q-geom2.mjs —— 组装BOM表「外观」列 + 上/下宽度对齐复测(表单登录,可靠)
 *
 * 用户口径(2026-10-28 截图):
 *   ①「把这个面板表格的外观那一列去掉不需要了」
 *   ②「表格调整对齐表格宽度，也可以同时调整上边宽度，不单单是调整下边的，这样子观感会好一点」
 *
 * 量真实像素:报告头 / 产品基本信息 / BOM表 各自 left/right/width,以及 BOM 表每列边界与表头列名。
 * 用法: node _q-geom2.mjs [base] [docNo]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const DOC = process.argv[3] || ''
const out = []
const log = (k, v) => {
  out.push({ k, v })
  console.log(`${k} = ${typeof v === 'object' ? JSON.stringify(v) : v}`)
}

const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => {
    if (!el) return false
    el.focus()
    const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value')
    d && d.set ? d.set.call(el, v) : (el.value = v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }
  set(ph('登录账号') || ph('账号'), 'admin')
  set(ph('登录密码') || ph('密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统'))
  if (!btn) return 'no-button'
  btn.click()
  return 'clicked'
})()`

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const lj = await lr.json()
const token = lj?.data?.token || ''

let docNo = DOC
if (!docNo) {
  const list = await (await fetch(BASE + '/api/px/queryFormDataList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode: 'RD_ASM_PROC', pageNo: 1, pageSize: 5, condition: {} }),
  })).json()
  const rows = list?.data?.list || []
  docNo = String(rows[0]?.['单据编号'] || '')
  log('候选单据', rows.map((r) => r['单据编号']).join(','))
}
log('目标单据', docNo || '(无)')

const s = await launch({ port: 9453 })
try {
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  log('登录', await s.evaluate(LOGIN_JS))
  await sleep(4500)
  log('登录后', await s.evaluate(`location.hash`))

  const url = `${BASE}/#/panelx/list/RD_ASM_PROC?docNo=${encodeURIComponent(docNo)}`
  await s.navigate(url); await sleep(6000)

  const d = await s.evaluate(`(() => ({
    href: location.hash,
    bodyLen: document.body ? document.body.innerText.length : -1,
    tabs: [...document.querySelectorAll('.rsp-page-tab')].map(x => (x.textContent||'').trim()),
    rsT: document.querySelectorAll('.rs-t').length,
  }))()`)
  log('单据页', d)

  // 切到 组装BOM表
  if ((d.tabs || []).some((t) => t.includes('组装BOM表'))) {
    log('点击组装BOM表', await s.evaluate(`(() => {
      const t = [...document.querySelectorAll('.rsp-page-tab')].find(x => (x.textContent||'').includes('组装BOM表'))
      if (!t) return false; t.click(); return true
    })()`))
    await sleep(1500)
  }

  const geom = await s.evaluate(`(() => {
    const R = (el) => { const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width) } }
    const vis = (el) => el && el.getClientRects().length > 0
    const tables = [...document.querySelectorAll('.rs-t')].filter(vis).map((t) => {
      const b = R(t)
      const hdr = [...t.querySelectorAll('tr')].find(tr => tr.querySelector('th'))
      const cols = hdr ? [...hdr.children].map(td => ({ t: (td.textContent||'').trim(), ...R(td) })) : []
      return { w: b.w, l: b.l, r: b.r, cls: t.className, cols }
    })
    // 表头里是否还有「外观要求」
    const allTh = [...document.querySelectorAll('.rs-t th')].filter(vis).map(th => (th.textContent||'').trim())
    return { tables, allTh }
  })()`)
  log('几何', geom)
  log('表头列名', geom.allTh)
  log('断言① = 表头无「外观要求」', geom.allTh.includes('外观要求') ? 'FAIL(仍在)' : 'PASS(已去掉)')
  const ws = [...new Set(geom.tables.map((t) => t.w))]
  const ls = [...new Set(geom.tables.map((t) => t.l))]
  const rs = [...new Set(geom.tables.map((t) => t.r))]
  log('宽度集合', ws); log('左缘集合', ls); log('右缘集合', rs)
  log('断言② = 上下一体同宽同缘', (ws.length === 1 && ls.length === 1 && rs.length === 1) ? 'PASS' : 'FAIL')

  await s.close?.()
} finally {
  const fs = await import('node:fs/promises')
  await fs.writeFile(new URL('./out-geom2.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  console.log('\n[written] out-geom2.json')
  process.exit(0)
}
