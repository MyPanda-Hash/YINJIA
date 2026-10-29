/**
 * _q-docno3.mjs —— 补齐三处事实(改前必须核实,否则会印出张冠李戴的标签)
 *   ① RD_INSP_PLAN:那格是输入框(值不在 textContent 里)⇒ 抓 input.value 看绑的是 单据编号 还是 文档编号
 *   ② RD_ASM_PROC:页 0「修订记录」showHead:false 没有报告头 ⇒ 切到后两个页签再抓
 *   ③ RD_SPEC_DOC:封面之外是否还有报告头页
 * 用法: node _q-docno3.mjs [base]
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

const GRAB = `(() => {
  const t = (e) => e ? (e.textContent || '').replace(/\\u00a0/g, ' ').replace(/\\s+/g, ' ').trim() : null
  const inp = document.querySelector('.rs-docno-input input') || document.querySelector('.rs-docno input')
  return {
    prefix: t(document.querySelector('.rs-docno-prefix')),
    cellText: t(document.querySelector('.rs-docno')),
    inputValue: inp ? inp.value : null,
    inputPh: inp ? (inp.placeholder || '') : null,
    tabs: [...document.querySelectorAll('.el-tabs__item')].map(t),
    activeTab: t(document.querySelector('.el-tabs__item.is-active')),
  }
})()`

const s = await launch({ port: 9465 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(4500)

  // ① RD_INSP_PLAN
  const insp = await firstNo('RD_INSP_PLAN')
  await s.navigate(`${BASE}/#/panelx/list/RD_INSP_PLAN?docNo=${encodeURIComponent(insp)}`); await sleep(7000)
  log('RD_INSP_PLAN(' + insp + ')', await s.evaluate(GRAB))

  // ② RD_ASM_PROC 逐页签
  const asm = await firstNo('RD_ASM_PROC')
  await s.navigate(`${BASE}/#/panelx/list/RD_ASM_PROC?docNo=${encodeURIComponent(asm)}`); await sleep(7000)
  log('RD_ASM_PROC 初始', await s.evaluate(GRAB))
  for (let i = 1; i <= 2; i++) {
    const clicked = await s.evaluate(`(() => {
      const ts = [...document.querySelectorAll('.el-tabs__item')]
      if (ts.length <= ${i}) return 'no-tab-' + ${i}
      ts[${i}].click(); return 'ok:' + (ts[${i}].textContent || '').trim()
    })()`)
    await sleep(3500)
    log('RD_ASM_PROC 页签' + i + '(' + clicked + ')', await s.evaluate(GRAB))
  }

  // ③ RD_SPEC_DOC 逐页签
  const sp = await firstNo('RD_SPEC_DOC')
  await s.navigate(`${BASE}/#/panelx/list/RD_SPEC_DOC?docNo=${encodeURIComponent(sp)}`); await sleep(7000)
  log('RD_SPEC_DOC 初始', await s.evaluate(GRAB))
  for (let i = 1; i <= 3; i++) {
    const clicked = await s.evaluate(`(() => {
      const ts = [...document.querySelectorAll('.el-tabs__item')]
      if (ts.length <= ${i}) return 'no-tab-' + ${i}
      ts[${i}].click(); return 'ok:' + (ts[${i}].textContent || '').trim()
    })()`)
    if (String(clicked).startsWith('no-tab')) { log('RD_SPEC_DOC 页签' + i, clicked); break }
    await sleep(3500)
    log('RD_SPEC_DOC 页签' + i + '(' + clicked + ')', await s.evaluate(GRAB))
  }
} finally {
  const fs = await import('node:fs/promises')
  await fs.writeFile(new URL('./out-docno3.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  process.exit(0)
}
