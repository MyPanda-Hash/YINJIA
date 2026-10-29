/**
 * _q-overflow-src.mjs —— 定位 组装BOM表 页签 36px 横向溢出的**具体元素**(谁超出了 .sheet-scroll)
 * 用法: node _q-overflow-src.mjs [base] [docNo] [tab]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:5173'
const DOC = process.argv[3] || 'AP-2026-10-0002'
const TAB = process.argv[4] || '组装BOM表'

const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号') || ph('账号'), 'admin')
  set(ph('登录密码') || ph('密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统'))
  btn && btn.click(); return 'clicked'
})()`

const s = await launch({ port: 9457 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(4500)
  await s.navigate(`${BASE}/#/panelx/list/RD_ASM_PROC?docNo=${encodeURIComponent(DOC)}`); await sleep(6000)
  await s.evaluate(`(() => { const t = [...document.querySelectorAll('.rsp-page-tab')].find(x => (x.textContent||'').trim() === ${JSON.stringify(TAB)}); t && t.click(); return true })()`)
  await sleep(1500)

  const r = await s.evaluate(`(() => {
    const sc = document.querySelector('.sheet-scroll')
    if (!sc) return { err: 'no .sheet-scroll' }
    const base = sc.getBoundingClientRect()
    const lim = base.left + sc.clientWidth
    const out = []
    for (const el of sc.querySelectorAll('*')) {
      const b = el.getBoundingClientRect()
      if (b.width === 0 && b.height === 0) continue
      if (Math.round(b.right) > Math.round(lim) + 1) {
        out.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 60), right: Math.round(b.right), over: Math.round(b.right - lim), w: Math.round(b.width), t: (el.textContent || '').trim().slice(0, 24) })
      }
    }
    return { clientWidth: sc.clientWidth, scrollWidth: sc.scrollWidth, lim: Math.round(lim), over: sc.scrollWidth - sc.clientWidth, offenders: out.slice(0, 20) }
  })()`)
  console.log(JSON.stringify(r, null, 2))
  await s.close?.()
} finally { process.exit(0) }
