/** _probe-cells.mjs — 精确定位「需交付/已排」三列单元格的渲染文本与原始行数据 */
const APP = 'http://127.0.0.1:8091'
const task = await taskSpace('wo-trace-qty-20261115')
const page = task.page('p1')
await page.goto(`${APP}/#/`, { timeout: 30000 })
await page.waitForTimeout(3500)
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
await page.goto(`${APP}/#/prod/plan/workOrderBoard`, { timeout: 45000 })
await page.waitForTimeout(9000)
await page.evaluate(() => {
  const hit = [...document.querySelectorAll('.wb-left *')].find((el) => (el.textContent || '').replace(/\s+/g, '') === '4号车间')
  if (hit) { hit.setAttribute('data-e2e', 'line-hit') }
})
try { await page.click('[data-e2e="line-hit"]') } catch (e) { console.log('click: ' + e.message) }
await page.waitForTimeout(7000)

const info = await page.evaluate(() => {
  const tb = [...document.querySelectorAll('.el-table')].find((t) => (t.textContent || '').includes('需交付'))
  if (!tb) return { err: 'no table' }
  const heads = [...tb.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim())
  const tr = tb.querySelector('tbody tr')
  const cells = tr ? [...tr.querySelectorAll('td')].map((td) => ({ t: (td.textContent || '').replace(/\s+/g, ' ').trim(), html: td.innerHTML.slice(0, 120) })) : []
  return { heads, cells }
})
console.log(JSON.stringify({
  heads: info.heads,
  wanted: (info.heads || []).map((h, i) => ({ i, h })).filter((x) => /需交付|已排|未交量|工序计划量|本线排产/.test(x.h)),
  cells: (info.cells || []).map((c, i) => ({ i, h: (info.heads || [])[i], t: c.t, html: c.html })).filter((x) => /需交付|已排|未交量|工序计划量|本线排产/.test(x.h || '')),
}, null, 2))

