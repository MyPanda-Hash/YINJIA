/**
 * _q-docno5.mjs —— 复验(RD_INSP_PLAN / RD_SPEC_DOC 上一轮像"head 没载入",疑似冷启动等待不够)
 * 做法:每个面板等页面出现「单据状态」等真实数据再抓,抓不到就明确回报,不猜。
 * 用法: node _q-docno5.mjs [base]
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
    coverDocno: t(document.querySelector('.rsp-cover-docno')),
    statusShown: /草稿|审批中|已审核|已通过|已归档/.test(t(document.body) || ''),
  }
})()`

const s = await launch({ port: 9467 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(5000)

  for (const p of ['RD_INSP_PLAN', 'RD_SPEC_DOC', 'RD_PROD_DOCLIST']) {
    const no = await firstNo(p)
    const q = no ? '?docNo=' + encodeURIComponent(no) : ''
    await s.navigate(`${BASE}/#/panelx/list/${p}${q}`)
    // 条件等待:最多 30s,直到那格出现非空值或有单据状态
    let r = null
    for (let i = 0; i < 15; i++) {
      await sleep(2000)
      r = await s.evaluate(GRAB)
      if (r.cellText && !/—$/.test(r.cellText)) break
      if (r.coverDocno && !/—$/.test(r.coverDocno)) break
      if (r.statusShown) break
    }
    log(p + '(' + no + ')', r)
  }
} finally {
  const fs = await import('node:fs/promises')
  await fs.writeFile(new URL('./out-docno5.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  process.exit(0)
}
