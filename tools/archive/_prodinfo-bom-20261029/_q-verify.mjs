/**
 * _q-verify.mjs —— 产品信息表/规格书 2026-10-29 两项功能验证
 *   ① 新建规格书草稿 ⇒ 「版本」= V+年月日(不是 V1.0);验证后把这张探针单作废。
 *   ② 产品信息表「三、产品BOM表」的「直接导入采购物料清单」按钮:点开弹窗有商品行、能落行。
 * 用法: node _q-verify.mjs [base]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const out = []
const log = (k, v) => { out.push({ k, v }); console.log(k, '=', typeof v === 'object' ? JSON.stringify(v) : v) }

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const token = (await lr.json())?.data?.token || ''
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }

// ── ① 新单版本 ──
const mk = await (await fetch(BASE + '/api/px/callButton', {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', buttonName: '提交', formData: {}, buttonParam: {} }),
})).json()
const newNo = String(mk?.data?.['编号'] || '')
const newVer = String(mk?.data?.['版本'] || '')
log('新建规格书', newNo || '(失败)')
log('版本(返回)', newVer)
log('断言① 版本 = V+年月日', /^V\d{4}-\d{2}-\d{2}$/.test(newVer) ? 'PASS' : 'FAIL')

// 清理:作废这张探针单
if (newNo) {
  const del = await (await fetch(BASE + '/api/px/deleteDoc', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', docNo: newNo }),
  })).json().catch(() => null)
  log('探针单清理', del ? (del.code || del.message) : '(接口不存在,需人工作废)')
}

// ── ② 导入按钮 ──
const list = await (await fetch(BASE + '/api/px/queryFormDataList', {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: 'RD_PROD_INFO', pageNo: 1, pageSize: 5, condition: {} }),
})).json()
const docNo = String((list?.data?.list || [])[0]?.['单据编号'] || '')
log('产品信息表单据', docNo)

const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号') || ph('账号'), 'admin')
  set(ph('登录密码') || ph('密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统'))
  btn && btn.click(); return 'clicked'
})()`

const s = await launch({ port: 9462 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(4500)
  await s.navigate(`${BASE}/#/panelx/list/RD_PROD_INFO${docNo ? '?docNo=' + encodeURIComponent(docNo) : ''}`); await sleep(6500)

  const btn = await s.evaluate(`(() => {
    const el = [...document.querySelectorAll('.rs-tool')].find(x => (x.textContent||'').includes('直接导入采购物料清单'))
    if (!el) return 'not-found'
    el.click(); return 'clicked'
  })()`)
  log('点「直接导入采购物料清单」', btn)
  await sleep(2500)
  const dlg = await s.evaluate(`(() => {
    const rows = document.querySelectorAll('.el-dialog .el-table__body tr').length
    const title = [...document.querySelectorAll('.el-dialog__title')].map(x => (x.textContent||'').trim())
    const hint = [...document.querySelectorAll('.el-dialog .mat-pick-hint, .el-dialog__body div')].map(x => (x.textContent||'').trim()).filter(t => t.includes('共') || t.includes('商品')).slice(0,2)
    return { rows, title, hint }
  })()`)
  log('弹窗', dlg)
  log('断言② 弹窗有商品行', dlg.rows > 0 ? 'PASS' : 'FAIL')
  await s.close?.()
} finally {
  const fs = await import('node:fs/promises')
  await fs.writeFile(new URL('./out-verify.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  process.exit(0)
}