// round-03.mjs — 扫工单码:填 0@GD-2026-11-0015@1001 → 回车 → 看工单卡片 + 物料清单
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')
await page.fill('.mm-scanbar input', '0@GD-2026-11-0015@1001')
await page.press('.mm-scanbar input', 'Enter')
await page.waitForTimeout(2500)
const state = await page.evaluate(() => ({
  order: document.querySelector('.mm-order-l1')?.textContent?.replace(/\s+/g, ' ').trim() || '',
  kv: [...document.querySelectorAll('.mm-kv .mm-v')].map((e) => e.textContent.trim()),
  scale: document.querySelector('.mm-scale')?.textContent?.replace(/\s+/g, ' ').trim() || '',
  prog: document.querySelector('.mm-prog')?.textContent?.trim() || '',
  empty: document.querySelector('.mm-list .el-empty__description')?.textContent?.trim() || '',
  rows: [...document.querySelectorAll('.mm-row')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  err: document.querySelector('.mm-alert .el-alert__title')?.textContent?.trim() || '',
  footBtn: document.querySelector('.mm-foot-btn')?.textContent?.trim() || '',
}))
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-20261118/r3-order.png' })
