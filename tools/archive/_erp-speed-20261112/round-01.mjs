/**
 * 转ERP 防重复入库 · 界面走查 第 1 轮(2026-11-12)
 *   ① 5173(源码即时生效)登录 admin / 正式库 YJ
 *   ② 打开 采购入库单 列表,选中 TCGRK-0048(已审核、未转ERP)
 *   ③ 打印工具栏按钮清单,确认「转ERP」还在、可点
 */
const OUT = 'C:/Users/Lenovo/ego/erp-dedup-20261112'
const task = await taskSpace('erp-dedup-20261112')
const page = task.page('p1')

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

async function loginIfNeeded() {
  const hash = await page.evaluate(() => location.hash)
  if (!hash.includes('/login')) return
  console.log('登录页 → 自动登录')
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const u = ins.find((i) => (i.placeholder || '').includes('账号'))
    const p = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (u) setVal(u, 'admin')
    if (p) setVal(p, '123456')
  })
  await page.waitForTimeout(600)
  // 登录工厂:选「YINJIA-MES」(正式库 HSDZ_MES)
  await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input')]
    const fac = inputs.find((i) => (i.placeholder || '').includes('工厂'))
    if (fac) fac.click()
  })
  await page.waitForTimeout(800)
  const picked = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item, li')]
    const target = items.find((el) => /YINJIA-MES(\s|$)/.test((el.textContent || '').trim()) && !/测试/.test(el.textContent || ''))
    if (target) { target.click(); return (target.textContent || '').trim() }
    return ''
  })
  console.log('登录工厂 =', picked)
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(4000)
}

await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 60000 })
await page.waitForTimeout(3000)
await loginIfNeeded()
console.log('当前路由 =', await page.evaluate(() => location.hash))
await restoreWindow()

// 选中 TCGRK-0048 那一行(点行首单元格即可设为当前行)
const rowInfo = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body-wrapper tr, .el-table__row')]
  const texts = rows.map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim())
  const idx = texts.findIndex((t) => t.includes('TCGRK-0048'))
  if (idx >= 0) {
    const cell = rows[idx].querySelector('td')
    if (cell) cell.click()
  }
  return { total: rows.length, idx, sample: texts.slice(0, 3) }
})
console.log('行定位 =', JSON.stringify(rowInfo))
await page.waitForTimeout(2500)

const ui = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.tb-main, .tb-caret')].map((el) => ({
    text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
    disabled: el.classList.contains('disabled'),
  }))
  const chip = document.querySelector('.doc-chip')
  const status = document.querySelector('.doc-status')
  const erpBtn = [...document.querySelectorAll('.tb-main')].find((el) => (el.textContent || '').trim() === '转ERP')
  return {
    buttons: btns.map((b) => (b.disabled ? b.text + '(灰)' : b.text)),
    docChip: chip ? chip.textContent.trim() : '',
    docStatus: status ? status.textContent.trim() : '',
    hasErpBtn: !!erpBtn,
    erpBtnDisabled: erpBtn ? erpBtn.classList.contains('disabled') : null,
  }
})
console.log('界面状态 =', JSON.stringify(ui, null, 2))
await page.screenshot({ path: `${OUT}/round-01-list.png` })
console.log('截图 =', `${OUT}/round-01-list.png`)
