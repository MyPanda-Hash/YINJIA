/** _probe-live.mjs — 现役 8090:页面内 fetch 排产明细,对比 DOM 显示值(排查"接口 50 / 界面 100") */
const APP = 'http://127.0.0.1:8090'
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
await page.reload()
await page.waitForTimeout(9000)
await page.evaluate(() => {
  const hit = [...document.querySelectorAll('.wb-left *')].find((el) => (el.textContent || '').replace(/\s+/g, '') === '4号车间')
  if (hit) hit.setAttribute('data-e2e', 'line-hit')
})
try { await page.click('[data-e2e="line-hit"]') } catch (e) { console.log('click: ' + e.message) }
await page.waitForTimeout(6000)

const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || localStorage.getItem('token') || ''
  const r = await fetch('/api/px/scheduleBoard/scheduled', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ 生产线: '4号车间', scope: '未完工' }),
  })
  const j = await r.json()
  const rows = (j.data || []).map((x) => ({ 单: x['加工单号'], 行: x['工单行号'], 需求: x['需求数量'], 排产: x['排产数量'], 工序计划: x['当前工序计划量'], 未交量: x['未交量'], 入库: x['入库数量'] }))
  const dp = await (await fetch('/api/px/scheduleBoard/dayPlan/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ 生产线: '4号车间', scope: '未完工' }),
  })).json()
  const dpRows = ((dp.data || {})['行'] || []).map((x) => ({ 行id: x['行id'], 工序: x['工序'], 需求: x['需求数量'], 排产: x['排产数量'], 工序计划量: x['工序计划量'], 需7: x['7天需交付'], 已排7: x['7天已排'] }))
  // DOM 里表格前两列值
  const tb = [...document.querySelectorAll('.el-table')].find((t) => (t.textContent || '').includes('需交付'))
  const heads = tb ? [...tb.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim()) : []
  const tr = tb ? tb.querySelector('tbody tr') : null
  const cells = tr ? [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()) : []
  const pick = {}
  heads.forEach((h, i) => { if (/订单数量|需交付|已排|未交量|本线排产数量|当前工序计划量|排产日期/.test(h)) pick[h] = cells[i] })
  return { href: location.href, api: rows, dayPlan: dpRows, dom: pick }
})
console.log(JSON.stringify(out, null, 2))
