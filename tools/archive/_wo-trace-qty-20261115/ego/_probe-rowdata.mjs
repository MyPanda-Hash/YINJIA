/** _probe-rowdata.mjs — 从 Vue 组件实例读 el-table 的 :data 第一行,看 15天需交付 到底有没有值 */
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
await page.goto(`${APP}/#/prod/plan/workOrderBoard`, { timeout: 45000 })
await page.waitForTimeout(9000)
await page.evaluate(() => {
  const hit = [...document.querySelectorAll('.wb-left *')].find((el) => (el.textContent || '').replace(/\s+/g, '') === '4号车间')
  if (hit) hit.setAttribute('data-e2e', 'line-hit')
})
try { await page.click('[data-e2e="line-hit"]') } catch (e) { console.log('click: ' + e.message) }
await page.waitForTimeout(7000)

const info = await page.evaluate(() => {
  const el = document.querySelector('.el-table')
  if (!el) return { err: 'no table' }
  // 沿 Vue 组件链找 el-table 组件的 props.data
  let comp = el.__vueParentComponent
  let depth = 0
  let data = null
  while (comp && depth < 8) {
    const p = comp.props || {}
    if (Array.isArray(p.data)) { data = p.data; break }
    comp = comp.parent
    depth++
  }
  const row = (data || [])[0] || {}
  const pick = {}
  for (const k of Object.keys(row)) {
    if (/交付|已排|需求数量|排产数量|未交量|工序/.test(k)) pick[k] = row[k]
  }
  return { found: !!data, depth, rowCount: (data || []).length, pick, hasKey: '15天需交付' in row, val: row['15天需交付'] }
})
console.log(JSON.stringify(info, null, 2))
