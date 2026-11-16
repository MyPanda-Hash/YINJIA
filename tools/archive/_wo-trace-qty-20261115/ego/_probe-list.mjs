/** _probe-list.mjs — 生产工单页 需交付三桶 是否同步改成工序计划量(同一后端服务,两页共用) */
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

await page.goto(`${APP}/#/prod/plan/workOrderList?keyword=GD-2026-11-0028`, { timeout: 45000 })
await page.reload()
await page.waitForTimeout(10000)

const dom = await page.evaluate(() => {
  const tb = [...document.querySelectorAll('.el-table')].find((t) => (t.textContent || '').includes('7天需交付'))
  if (!tb) return { found: false }
  const head = [...tb.querySelectorAll('.el-table__header th')].map((th) => ({
    text: (th.textContent || '').replace(/\s+/g, ' ').trim(),
    tip: (th.querySelector('span[title]') || {}).title || '',
  }))
  const rows = [...tb.querySelectorAll('.el-table__body tbody tr')].map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()))
  return { found: true, head, rows }
})
console.log('found=' + dom.found)
const idx = (n) => (dom.head || []).findIndex((h) => h.text.includes(n))
const pick = (name) => (dom.head || [])[idx(name)] || {}
const row = (dom.rows || [])[0] || []
const cell = (n) => row[idx(n)]
console.log('列头(需交付/已排/排产) = ' + JSON.stringify((dom.head || []).filter((h) => /需交付|已排|排产数量|需求数量/.test(h.text)).map((h) => h.text)))
console.log('第一行 = ' + JSON.stringify({
  工单号: cell('工单号'), 需求数量: cell('需求数量'), 排产数量: cell('排产数量'),
  当前工序计划量: cell('当前工序计划量'),
  '7天需交付': cell('7天需交付'), '15天需交付': cell('15天需交付'), '大于15天需交付': cell('大于15天需交付'),
  '7天已排': cell('7天已排'),
  tip7: pick('7天需交付').tip.slice(0, 40),
}))
