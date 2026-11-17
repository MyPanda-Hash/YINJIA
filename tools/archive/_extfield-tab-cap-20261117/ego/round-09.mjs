// round-09: (会话过期)先登录测试库 → 打开「自定义字段」→ 看 19/20(只剩 1 个位置)的提示与禁用
const task = await taskSpace('extfield-tab-cap-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REQ_SERIES', { timeout: 30000 })
await page.waitForTimeout(6000)

const needLogin = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('登录账号')))
console.log('需要登录 =', needLogin)
if (needLogin) {
  // 确认登录工厂 = 测试库(默认按上次选择),没有就选
  const fac = await page.evaluate(() => [...document.querySelectorAll('.el-form-item')]
    .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).find((t) => t.includes('登录工厂')))
  console.log('登录工厂 =', fac)
  if (fac && !fac.includes('测试库')) {
    await page.evaluate(() => {
      const it = [...document.querySelectorAll('.el-form-item')].find((el) => (el.textContent || '').includes('登录工厂'))
      ;(it?.querySelector('.el-select__wrapper') || it?.querySelector('.el-select'))?.click()
    })
    await page.waitForTimeout(600)
    await page.evaluate(() => {
      const o = [...document.querySelectorAll('.el-select-dropdown__item')].find((el) => (el.textContent || '').includes('测试库'))
      if (o) o.click()
    })
    await page.waitForTimeout(500)
  }
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('登录账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('登录密码')), '123456')
  })
  await page.waitForTimeout(300)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统'))
    if (b) b.click()
  })
  await page.waitForTimeout(6000)
  console.log('登录后 hash =', await page.evaluate(() => location.hash), '| 账套 =', await page.evaluate(() => (document.querySelector('.factory .factory-name')?.textContent || '').trim()))
  // 回到目标面板
  await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REQ_SERIES', { timeout: 30000 })
  await page.waitForTimeout(8000)
}
console.log('面板 hash =', await page.evaluate(() => location.hash), '| sheet =', await page.evaluate(() => !!document.querySelector('.qc-insp-sheet')))

await page.evaluate(() => {
  const n = [...document.querySelectorAll('.qc-insp-sheet *')]
    .find((e) => e.children.length <= 1 && (e.textContent || '').replace(/\s+/g, ' ').trim().replace(/^[^\w\u4e00-\u9fa5]+/, '') === '自定义字段')
  if (n) n.click()
})
await page.waitForTimeout(4000)
const st = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('字段管理'))
  if (!d) return { noDialog: true, dialogs: [...document.querySelectorAll('.el-dialog')].map((x) => (x.textContent || '').slice(0, 40)) }
  const btn = [...d.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '添加')
  return {
    summary: (d.querySelector('.fm-summary')?.textContent || '').trim(),
    chip: (d.querySelector('.fm-tabusage-item')?.textContent || '').trim(),
    alerts: [...d.querySelectorAll('.el-alert__title')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
    alertsAll: [...d.querySelectorAll('.el-alert')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90)),
    addDisabled: btn ? btn.disabled : null,
  }
})
console.log('19/20 状态 =', JSON.stringify(st, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/extfield-tab-cap-20261117/round-09-pairshort.png' })
console.log('done round-09')
