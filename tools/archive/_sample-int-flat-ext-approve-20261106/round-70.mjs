const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
await page.goto(BASE + '/#/login', { timeout: 60000 })
await page.waitForTimeout(3200)
await page.evaluate(() => {
  const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
  const ins = [...document.querySelectorAll('input')]
  const u = ins.find((i) => (i.placeholder || '').includes('账号')); const p = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (u) setVal(u, 'admin'); if (p) setVal(p, '123456')
})
await page.waitForTimeout(400)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统')); if (b) b.click() })
await page.waitForTimeout(6800)
try { await page.cdp('Network.clearBrowserCache', {}) } catch (e) {}
await page.goto(BASE + '/#/panelx/list/RD_SAMPLE_INT', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(10000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
const intSt = await page.evaluate(() => ({
  rows: document.querySelectorAll('.el-table__row').length,
  headers: [...document.querySelectorAll('.col-hdr-text')].map((e) => (e.textContent || '').trim()).filter(Boolean),
  filterIcons: document.querySelectorAll('.col-hdr-ic').length + document.querySelectorAll('.col-hdr-sort').length,
  toolbar: [...document.querySelectorAll('.as-toolbar button, .el-button')].map((e) => (e.textContent || '').replace(/\s+/g, '')).filter(Boolean).slice(0, 12),
  hasApproval: [...document.querySelectorAll('button, .as-side-btn')].some((e) => /提交审批|审批通过|审批驳回/.test(e.textContent || '')),
}))
console.log('内部样品单 =', JSON.stringify(intSt, null, 1))
const shot1 = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/prod-sample-int-flat.png' })
console.log('shot1 =', shot1)
// 外部单:打开的是一张 审批中(node1) 的单 → 点审批通过只验证弹窗,随后取消
await page.goto(BASE + '/#/panelx/list/RD_SAMPLE_EXT?focus=SPW-2026-11-0001', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(10000)
const opened = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn, button')].find((x) => (x.textContent || '').trim() === '审批通过')
  if (!b) return 'NO_BTN'
  b.click(); return 'CLICKED'
})
console.log('外部单点审批通过 =', opened)
await page.waitForTimeout(2500)
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.getBoundingClientRect().height > 0).pop()
  if (!d) return { error: 'NO_DIALOG' }
  return {
    title: (d.querySelector('.el-dialog__title') || {}).textContent || '',
    labels: [...d.querySelectorAll('.dq-label')].map((e) => (e.textContent || '').trim()),
    rows: d.querySelectorAll('.sl1-row').length,
    text: (d.textContent || '').replace(/\s+/g, ' ').slice(0, 140),
    btns: [...d.querySelectorAll('.el-dialog__footer button')].map((b) => (b.textContent || '').trim()),
  }
})
console.log('回填弹窗 =', JSON.stringify(dlg, null, 1))
const shot2 = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/prod-sample-ext-l1.png' })
console.log('shot2 =', shot2)
// 取消(不改动生产数据)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.getBoundingClientRect().height > 0).pop()
  const b = d && [...d.querySelectorAll('.el-dialog__footer button')].find((x) => (x.textContent || '').trim() === '取消')
  if (b) b.click()
})
await page.waitForTimeout(800)
console.log('已取消弹窗(生产单据未被推进)')
