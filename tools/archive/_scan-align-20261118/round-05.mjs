const task = await taskSpace('scan-align-20261118')
const page = task.page('p1')
const shots = 'C:/Users/Lenovo/ego/scan-align-20261118/'
const out = {}

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_RETURN', { timeout: 30000 })
await page.waitForTimeout(4000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { /* skip */ }

out.before = await page.evaluate(() => ({
  hasInlineWork: !!document.querySelector('.mr-work'),
  hasGroupHead: !!document.querySelector('.mr-grp-head'),
  grpText: (document.querySelector('.mr-grp-head')?.innerText || '').replace(/\s+/g, ' ').trim(),
  rows: document.querySelectorAll('.mr-doc').length,
}))
await page.screenshot({ path: shots + 'round-05-list.png' })

// 收缩:点分组头 ⇒ 列表收起
await page.evaluate(() => document.querySelector('.mr-grp-head').click())
await page.waitForTimeout(600)
out.collapsed = await page.evaluate(() => ({
  rows: document.querySelectorAll('.mr-doc').length,
  arrowOpen: !!document.querySelector('.mr-grp-arrow.open'),
}))
// 再展开
await page.evaluate(() => document.querySelector('.mr-grp-head').click())
await page.waitForTimeout(600)
out.expanded = await page.evaluate(() => ({
  rows: document.querySelectorAll('.mr-doc').length,
  arrowOpen: !!document.querySelector('.mr-grp-arrow.open'),
}))

// 点第一张「选这张退料」⇒ 应弹出明细弹窗(不再是内联作业区)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '选这张退料')
  if (b) b.click()
})
await page.waitForTimeout(3000)
out.dialog = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.innerText || '').includes('退料') && d.offsetParent !== null)
  return {
    hasDialog: !!dlg,
    title: dlg ? (dlg.querySelector('.el-dialog__title')?.textContent || '').trim() : '',
    bodyText: dlg ? (dlg.innerText || '').replace(/\s+/g, ' ').slice(0, 260) : '',
    focusPh: document.activeElement ? document.activeElement.placeholder || '' : '',
    inlineWork: !!document.querySelector('.mr-work'),
  }
})
await page.screenshot({ path: shots + 'round-05-dialog.png' })

// 弹窗里扫物料码 → 应显示「本次可退」
await page.fill('input[placeholder*="扫物料码"]', 'YJ-KBL-003')
await page.waitForTimeout(300)
await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.innerText || '').includes('退料'))
  const b = [...(dlg ? dlg.querySelectorAll('button') : [])].find((x) => (x.textContent || '').trim() === '查询')
  if (b) b.click()
})
await page.waitForTimeout(2500)
out.afterScan = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.innerText || '').includes('退料') && d.offsetParent !== null)
  return {
    bodyText: dlg ? (dlg.innerText || '').replace(/\s+/g, ' ').slice(0, 320) : '',
    hasCanBlock: !!document.querySelector('.mr-mat-can'),
  }
})
await page.screenshot({ path: shots + 'round-05-dialog-scanned.png' })

console.log(JSON.stringify(out, null, 2))
