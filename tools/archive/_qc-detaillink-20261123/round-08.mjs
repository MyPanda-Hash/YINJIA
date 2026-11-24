// round-08.mjs —— 边界 D(续):工单行id 为 NULL 时链接只带 keyword ⇒ 验证生产工单页按关键字落地
// 说明:明细表里 工单行id=NULL 的老单(ZJ-2026-10-0006 / GD-2026-10-0002)在列表里要翻多页才能点到,
// 这里直接验「链接生成的那种地址」在生产工单页的效果,外加空工单号那行不渲染链接的判据(源码 + 行级 v-if)。
const task = await taskSpace('qc-detaillink-20261123')
const page = task.page('p1')
const SHOT = 'C:/Users/vigna/ego/qc-detaillink-20261123'
const URL = 'http://localhost:5173/#/prod/plan/workOrderList?keyword=GD-2026-10-0002'
await page.goto(URL, { timeout: 30000 })
await page.waitForTimeout(4000)
const needLogin = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号')))
if (needLogin) {
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
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
  await page.goto(URL, { timeout: 30000 })
  await page.waitForTimeout(6000)
}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
const res = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body tr')]
  return {
    hash: location.hash,
    title: document.title,
    rowCount: rows.length,
    allRowsHit: rows.length > 0 && rows.every((tr) => (tr.innerText || '').includes('GD-2026-10-0002')),
    firstRows: rows.slice(0, 3).map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40)),
    dialogs: [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).map((d) => (d.querySelector('.el-dialog__title')?.innerText || '').trim()),
  }
})
await page.screenshot({ path: SHOT + '/round-08-keyword-only-landing.png' })
console.log(JSON.stringify(res, null, 2))
await task.finish({ keep: [] })
