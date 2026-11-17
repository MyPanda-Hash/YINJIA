// round-22: 新增明细行后「合格数量」是不是还是自动 0(应该留空),「不合格数量」仍是 0(用户允许)
const task = await taskSpace('extfield-tab-cap-20261117')
const page = task.page('p1')
const BASE = 'http://localhost:5173'

await page.goto(`${BASE}/#/panelx/list/QC_INSP`, { timeout: 30000 })
await page.waitForTimeout(4000)
const need = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('登录账号')))
if (need) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('登录账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('登录密码')), '123456')
  })
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))?.click())
  await page.waitForTimeout(6000)
  await page.goto(`${BASE}/#/panelx/list/QC_INSP`, { timeout: 30000 })
}
await page.reload({ timeout: 30000 })
await page.waitForTimeout(9000)
console.log('账套 =', await page.evaluate(() => (document.querySelector('.factory .factory-name')?.textContent || '').trim()))

// 打开一张草稿
const picked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
  for (const tr of rows) {
    if ((tr.textContent || '').includes('草稿')) { (tr.querySelector('td') || tr).click(); return (tr.textContent || '').replace(/\s+/g, ' ').slice(0, 60) }
  }
  if (rows.length) { (rows[0].querySelector('td') || rows[0]).click(); return '首行' }
  return null
})
console.log('打开 =', picked)
await page.waitForTimeout(5000)

const before = await page.evaluate(() => {
  const ths = [...document.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').replace(/[⇅×]/g, '').trim())
  const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
  const cells = rows.length ? [...rows[rows.length - 1].querySelectorAll('td')].map((td) => (td.textContent || '').trim()) : []
  return { headerNo: [...document.querySelectorAll('input')].map((i) => i.value).find((v) => String(v).startsWith('IJ-')), ths, rowCount: rows.length, lastRow: cells }
})
console.log('点新增前 =', JSON.stringify(before, null, 2))

// 点「新增数据」(明细加行)
const added = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button, .el-button, .as-side-btn, span, div')]
    .filter((e) => e.offsetParent !== null && /^(\+ )?新增数据$/.test((e.textContent || '').trim()))
  if (!btn.length) return 'none'
  btn[0].click()
  return (btn[0].textContent || '').trim()
})
console.log('点新增数据 =', added)
await page.waitForTimeout(2000)

const after = await page.evaluate(() => {
  const ths = [...document.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').replace(/[⇅×]/g, '').trim())
  const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
  const last = rows.length ? [...rows[rows.length - 1].querySelectorAll('td')].map((td) => (td.textContent || '').trim()) : []
  const pick = (name) => {
    const i = ths.findIndex((t) => t === name)
    return i >= 0 ? last[i] : '(列不存在)'
  }
  return {
    rowCount: rows.length,
    ths,
    lastRow: last,
    送检数量: pick('送检数量'),
    合格数量: pick('合格数量'),
    不合格数量: pick('不合格数量'),
    报废数量: pick('报废数量'),
  }
})
console.log('点新增后 =', JSON.stringify(after, null, 2))

// 输入值(不是空串/0 的证明)
const state = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
  const tr = rows[rows.length - 1]
  return [...tr.querySelectorAll('td')].map((td, i) => ({
    i, txt: (td.textContent || '').trim(),
    hasInput: !!td.querySelector('input'),
    inputVal: td.querySelector('input')?.value ?? null,
  })).filter((c) => c.hasInput || c.txt)
})
console.log('末行单元格细节 =', JSON.stringify(state, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/extfield-tab-cap-20261117/round-22-newrow.png' })
console.log('done round-22(未保存,单据未改动)')
