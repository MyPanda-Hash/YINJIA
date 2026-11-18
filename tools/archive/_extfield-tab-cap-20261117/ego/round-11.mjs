// round-11: 20/20(本表已满)—— 应显示「本表自定义列已达上限（20/20）」并禁用「添加」
// 注意:同 URL 的 goto 在 SPA 里是 no-op(上一轮留下的对话框会保持旧数据),所以这里显式 reload。
const task = await taskSpace('extfield-tab-cap-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REQ_SERIES', { timeout: 30000 })
await page.reload({ timeout: 30000 })
await page.waitForTimeout(9000)

const needLogin = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('登录账号')))
console.log('需要登录 =', needLogin, '| 账套 =', await page.evaluate(() => (document.querySelector('.factory .factory-name')?.textContent || '').trim()))
if (needLogin) {
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
  await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REQ_SERIES', { timeout: 30000 })
  await page.waitForTimeout(9000)
}

await page.evaluate(() => {
  const n = [...document.querySelectorAll('.qc-insp-sheet *')]
    .find((e) => e.children.length <= 1 && (e.textContent || '').replace(/\s+/g, ' ').trim().replace(/^[^\w\u4e00-\u9fa5]+/, '') === '自定义字段')
  if (n) n.click()
})
await page.waitForTimeout(4500)
const st = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('字段管理'))
  if (!d) return { noDialog: true }
  const btn = [...d.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '添加')
  return {
    summary: (d.querySelector('.fm-summary')?.textContent || '').trim(),
    chip: (d.querySelector('.fm-tabusage-item')?.textContent || '').trim(),
    alerts: [...d.querySelectorAll('.el-alert__title')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
    addDisabled: btn ? btn.disabled : null,
    rows: [...d.querySelectorAll('.el-table__body tbody tr')].length,
  }
})
console.log('20/20 状态 =', JSON.stringify(st, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/extfield-tab-cap-20261117/round-11-full.png' })
console.log('done round-11')
