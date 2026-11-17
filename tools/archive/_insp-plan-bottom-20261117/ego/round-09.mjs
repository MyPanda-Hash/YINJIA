// round-09:用 ?new=1 直接新建一张草稿(测试库),看频率下拉候选 + 底层合并格可编辑
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN?new=1', { timeout: 60000 })
await page.waitForTimeout(7000)
// 关掉可能出现的遮挡弹窗后取状态
console.log(JSON.stringify(await page.evaluate(() => {
  const dt = document.querySelector('table.rs-dt')
  const ff = document.querySelector('.rsp-footer-field')
  return {
    hash: location.hash,
    docNoMatch: (document.body.innerText.match(/IP-\d{4}-\d{2}-\d{4}/) || [])[0] || null,
    headers: dt ? [...dt.querySelectorAll('th')].map((e) => (e.textContent || '').trim()) : null,
    selectCount: dt ? dt.querySelectorAll('.el-select').length : 0,
    footerEditable: !!(ff && ff.querySelector('textarea')),
    footerText: ff ? (ff.textContent || '').replace(/\s+/g, ' ').slice(0, 160) : null,
    sideBtns: [...document.querySelectorAll('.as-side-btn')].map((e) => (e.textContent || '').trim()),
    msgs: [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').trim()),
  }
}), null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-09.png' })
