/**
 * _q-docno4.mjs —— 找页签真实 DOM + 逐页抓「编号」格(RD_ASM_PROC / RD_SPEC_DOC / RD_INSP_PLAN)
 * 用法: node _q-docno4.mjs [base]
 *
 * 上一轮 .el-tabs__item 一个都没抓到 ⇒ 这些文书面板的页签不是 el-tabs。
 * 设计里它们是纸面第 1 行那几个页签按钮(RecordSheetPanels 自绘),故先列出候选类名再点。
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

async function firstNo(p) {
  const r = await (await fetch(BASE + '/api/px/queryFormDataList', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: p, pageNo: 1, pageSize: 1, condition: {} }),
  })).json()
  const row = (r?.data?.list || [])[0] || {}
  return String(row['单据编号'] || row['编号'] || '')
}

const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号') || ph('账号'), 'admin'); set(ph('登录密码') || ph('密码'), '123456')
  const btn = document.querySelector('.login-submit'); btn && btn.click(); return 'clicked'
})()`

/** 列出所有含「页/签/tab/page」的类名 + 它们的文字,用来定位页签控件 */
const DOM_SCAN = `(() => {
  const t = (e) => (e.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 30)
  const set = new Set()
  document.querySelectorAll('*').forEach(e => {
    const c = String(e.className || '')
    if (!/tab|page|sheet/i.test(c)) return
    const s = t(e)
    if (s && s.length < 30) set.add(c + ' >>> ' + s)
  })
  return [...set].slice(0, 40)
})()`

const GRAB = `(() => {
  const t = (e) => e ? (e.textContent || '').replace(/\\u00a0/g, ' ').replace(/\\s+/g, ' ').trim() : null
  const inp = document.querySelector('.rs-docno-input input') || document.querySelector('.rs-docno input')
  return {
    prefix: t(document.querySelector('.rs-docno-prefix')),
    cellText: t(document.querySelector('.rs-docno')),
    inputValue: inp ? inp.value : null,
    coverDocno: t(document.querySelector('.rsp-cover-docno')),
  }
})()`

const s = await launch({ port: 9466 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(4500)

  const asm = await firstNo('RD_ASM_PROC')
  await s.navigate(`${BASE}/#/panelx/list/RD_ASM_PROC?docNo=${encodeURIComponent(asm)}`); await sleep(7000)
  log('RD_ASM_PROC DOM候选', await s.evaluate(DOM_SCAN))
  log('RD_ASM_PROC 当前格', await s.evaluate(GRAB))

  const sp = await firstNo('RD_SPEC_DOC')
  await s.navigate(`${BASE}/#/panelx/list/RD_SPEC_DOC?docNo=${encodeURIComponent(sp)}`); await sleep(7000)
  log('RD_SPEC_DOC DOM候选', await s.evaluate(DOM_SCAN))
  log('RD_SPEC_DOC 封面格', await s.evaluate(GRAB))
} finally {
  const fs = await import('node:fs/promises')
  await fs.writeFile(new URL('./out-docno4.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  process.exit(0)
}
