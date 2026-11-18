const task = await taskSpace('jjf-twolevel-20261117')
const page = task.page('p1')
// 承接 round-09 已弹出的确认框:点「确认审批通过」
const ok = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box__btns button, .el-dialog__footer button')]
    .find((x) => (x.textContent || '').replace(/\s+/g, '') === '确认审批通过')
  if (!b) return false
  b.click()
  return true
})
console.log('confirmed:', ok)
await page.waitForTimeout(4000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.waitForTimeout(1200)
const info = await page.evaluate(() => {
  const sheet = document.querySelector('.approval-sheet') || document.body
  return {
    toast: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()),
    statusTag: [...document.querySelectorAll('.el-tag')].map((t) => (t.textContent || '').trim()).filter(Boolean).slice(0, 4),
    foot: [...sheet.querySelectorAll('div')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => /^(编制|审核|批准)：/.test(t)).slice(0, 1),
    btns: [...document.querySelectorAll('.as-side-btn, .as-side-btns button, .as-side-btns .el-button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/jjf-twolevel-20261117/r10-approved.png' })
console.log('done')
