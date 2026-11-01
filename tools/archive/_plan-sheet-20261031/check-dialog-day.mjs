/** 复核:双击日期列开弹窗时,「当天数量」默认是今天那一列(2026-11-01) */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
const BASE = 'http://127.0.0.1:8090'
const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号'), 'admin'); set(ph('登录密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统'))
  if (!btn) return 'no-button'; btn.click(); return 'clicked'
})()`
const s = await launch({ port: 9487 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 900, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  console.log('登录', await s.evaluate(LOGIN_JS)); await sleep(4000)
  await s.navigate(BASE + '/#/prod/plan/workOrderBoard'); await sleep(7000)
  console.log('选线', await s.evaluate(`(() => { const i=[...document.querySelectorAll('.wb-line')]; const h=i.find(x=>((x.querySelector('.wb-line-name')||{}).innerText||'').trim()==='1号机'); if(!h) return 'no-node'; (h.querySelector('.wb-line-name')||h).click(); return 'clicked' })()`))
  await sleep(6000)
  console.log('双击开工日期格', await s.evaluate(`(() => {
    const tr = [...document.querySelectorAll('.el-table__body tr.el-table__row')].find(r => (r.innerText||'').includes('GD-2026-10-0226-1'))
    const el = tr && tr.querySelector('.dp-date-cell')
    if (!el) return 'no-cell'
    el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return 'dblclicked'
  })()`))
  await sleep(1500)
  console.log('弹窗当天标题', await s.evaluate(`(() => {
    const dlg = document.querySelector('.el-dialog')
    if (!dlg) return 'no-dialog'
    return JSON.stringify({ 标题: (dlg.querySelector('.sq-title')||{}).innerText, 数量框: !!(dlg.querySelector('.sq-num input')) })
  })()`))
  const png = await s.send('Page.captureScreenshot', { format: 'png' })
  await fs.writeFile(new URL('./shot-dialog-board.png', import.meta.url), Buffer.from(png.result.data, 'base64'))
  console.log('[written] shot-dialog-board.png')
} finally { try { s.close?.() } catch {} }
