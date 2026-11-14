/* round-01.mjs — 检验数据记录明细表首轮:登录(测试库) → 打开面板 → 取列头/行数/分页证据 */
const task = await taskSpace('qc-pending-detail-20261111')
console.log('spaceId=' + task.spaceId)
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 30000 })
await page.waitForTimeout(4000)

// 登录态过期 → 在登录页自动登录(工厂下拉选 测试库 YJ_TEST)
const state = await page.evaluate(() => {
  const has = (sel) => !!document.querySelector(sel)
  return {
    hash: location.hash,
    isLogin: !!document.querySelector('input[placeholder*="账号"]'),
    hasTable: has('.report-table') || !!document.querySelector('.el-table'),
    text: (document.body.innerText || '').slice(0, 400),
  }
})
console.log(JSON.stringify(state, null, 2))

if (state.isLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  })
  await page.waitForTimeout(500)
  // 登录工厂 = 测试库(下拉是 el-select:点开 → 选 YJ_TEST)
  const picked = await page.evaluate(() => {
    const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('工厂'))
    if (!inp) return 'no-factory-input'
    inp.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    inp.click()
    return 'clicked'
  })
  console.log('factory pick: ' + picked)
  await page.waitForTimeout(800)
  const opt = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')]
    return items.map((el) => (el.textContent || '').trim())
  })
  console.log('factory options: ' + JSON.stringify(opt))
  const idx = opt.findIndex((t) => t.includes('测试'))
  if (idx >= 0) {
    await page.evaluate((i) => {
      const items = [...document.querySelectorAll('.el-select-dropdown__item')]
      items[i].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }, idx)
    await page.waitForTimeout(500)
  }
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
  await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 30000 })
  await page.waitForTimeout(5000)
}

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

const info = await page.evaluate(() => {
  const th = [...document.querySelectorAll('.el-table__header th')].map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim())
  const bodyRows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const first = bodyRows[0]
    ? [...bodyRows[0].querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim())
    : []
  const pager = [...document.querySelectorAll('.el-pagination')].map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim())
  const title = document.title
  return { mask: location.hash, title, th, rowCount: bodyRows.length, first, pager }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-pending-detail-20261111/round-01.png' })
