/**
 * _q-overflow-all.mjs —— 三个页签各自的横向溢出量(判断 36px 是否为我这次改动引入)
 * 用法: node _q-overflow-all.mjs [base] [docNo]
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

const s = await launch({ port: 9456 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(4500)
  await s.navigate(`${BASE}/#/panelx/list/RD_ASM_PROC?docNo=${encodeURIComponent(DOC)}`); await sleep(6000)

  const tabs = ['修订记录', '组装BOM表', '组装工艺清单']
  for (const name of tabs) {
    await s.evaluate(`(() => { const t = [...document.querySelectorAll('.rsp-page-tab')].find(x => (x.textContent||'').trim() === ${JSON.stringify(name)}); t && t.click(); return true })()`)
    await sleep(1200)
    const r = await s.evaluate(`(() => {
      const sc = document.querySelector('.sheet-scroll')
      const vis = [...document.querySelectorAll('.rs-t')].filter(e => e.getClientRects().length)
      const R = (e) => { const b = e.getBoundingClientRect(); return Math.round(b.width) }
      return {
        scroll: sc ? { sw: sc.scrollWidth, cw: sc.clientWidth, over: sc.scrollWidth - sc.clientWidth } : null,
        widths: [...new Set(vis.map(R))],
      }
    })()`)
    console.log(name, '=>', JSON.stringify(r))
  }
  await s.close?.()
} finally { process.exit(0) }
