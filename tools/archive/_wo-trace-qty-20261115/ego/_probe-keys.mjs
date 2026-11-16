/** _probe-keys.mjs — 对比接口返回键名 与 前端列 prop 的字符级差异(排查 15天需交付 渲染为空) */
const APP = 'http://127.0.0.1:8091'
const task = await taskSpace('wo-trace-qty-20261115')
const page = task.page('p1')
await page.goto(`${APP}/#/`, { timeout: 30000 })
await page.waitForTimeout(3000)
const needLogin = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('进入系统')))
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  })
  await page.waitForTimeout(400)
  await page.evaluate(() => { const sel = document.querySelector('.el-select__wrapper') || document.querySelector('.el-select'); if (sel) sel.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  await page.waitForTimeout(600)
  await page.evaluate(() => { const items = [...document.querySelectorAll('.el-select-dropdown__item')]; const t = items.find((it) => (it.textContent || '').replace(/\s+/g, '').includes('YINJIA-MES') && !(it.textContent || '').includes('测试')); if (t) t.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  await page.waitForTimeout(400)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统')); if (b) b.click() })
  await page.waitForTimeout(6000)
}

const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || localStorage.getItem('token') || ''
  const r = await fetch('/api/px/scheduleBoard/dayPlan/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ 生产线: '4号车间', scope: '未完工' }),
  })
  const j = await r.json()
  const row = (j.data || {})['行'] ? (j.data['行'][0] || {}) : {}
  const keys = Object.keys(row)
  return {
    tokenFound: !!token,
    keys: keys,
    codes: keys.filter((k) => k.includes('交付') || k.includes('已排')).map((k) => ({
      k, codes: [...k].map((c) => c.charCodeAt(0)),
      v: row[k],
    })),
  }
})
console.log('token=' + out.tokenFound)
console.log('全部键 = ' + JSON.stringify(out.keys))
console.log(JSON.stringify(out.codes, null, 2))
