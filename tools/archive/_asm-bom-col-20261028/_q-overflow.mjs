/**
 * _q-overflow.mjs —— 检查 组装BOM表 页签是否有横向溢出(滚动条),以及上下缘/列宽明细
 * 用法: node _q-overflow.mjs [base] [docNo]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:5173'
const DOC = process.argv[3] || 'AP-2026-10-0002'

const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号') || ph('账号'), 'admin')
  set(ph('登录密码') || ph('密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统'))
  btn && btn.click(); return 'clicked'
})()`

const s = await launch({ port: 9455 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(4500)
  await s.navigate(`${BASE}/#/panelx/list/RD_ASM_PROC?docNo=${encodeURIComponent(DOC)}`); await sleep(6000)
  await s.evaluate(`(() => { const t = [...document.querySelectorAll('.rsp-page-tab')].find(x => (x.textContent||'').includes('组装BOM表')); t && t.click(); return true })()`)
  await sleep(1500)

  const r = await s.evaluate(`(() => {
    const R = (el) => { const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width) } }
    // 找所有可能横向溢出的容器
    const cands = [...document.querySelectorAll('div, main, section')].filter((el) => {
      const cs = getComputedStyle(el)
      return (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1
    }).map((el) => ({ cls: el.className || el.tagName, sw: el.scrollWidth, cw: el.clientWidth }))
    const body = { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }
    const sheets = [...document.querySelectorAll('.rs-t')].filter(e => e.getClientRects().length).map(R)
    const wrap = document.querySelector('.rsp-dt-wrap')
    return { body, scrollables: cands.slice(0, 8), sheets, wrap: wrap ? { ...R(wrap), sw: wrap.scrollWidth, cw: wrap.clientWidth } : null }
  })()`)
  console.log(JSON.stringify(r, null, 2))
  console.log('横向溢出?', r.body.sw > r.body.cw ? 'FAIL(页面溢出 ' + (r.body.sw - r.body.cw) + 'px)' : 'PASS(无溢出)')
  console.log('可滚动容器数 =', r.scrollables.length)
  await s.close?.()
} finally { process.exit(0) }
