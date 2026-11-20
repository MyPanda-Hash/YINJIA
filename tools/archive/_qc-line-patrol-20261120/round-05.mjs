const task = await taskSpace('qc-line-patrol-20261120')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 30000 })
await page.waitForTimeout(4000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1680, height: 1000 } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
// 选左栏第一张单(最新的 XJ-2026-11-0008)
const picked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.doc-select-rail tbody tr, .doc-select-rail .dsr-row, .doc-select-rail tr')]
  const row = rows.find((r) => (r.textContent || '').includes('XJ-2026-11-0008'))
  if (!row) return false
  row.click(); return true
})
console.log('pick doc =', picked)
await page.waitForTimeout(3000)
const side = async (label) => page.evaluate((label) => {
  const el = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === label)
  if (!el) return false
  el.click(); return true
}, label)
const confirmDialogs = async () => {
  // 审批意见弹窗/确认框:有 textarea 就写意见,再点确定
  const handled = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog, .el-message-box')
    if (!dlg) return null
    const ta = dlg.querySelector('textarea')
    if (ta) {
      const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      s.call(ta, '自动化验收'); ta.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const btn = [...dlg.querySelectorAll('button')].find((b) => /确定|确认|通过/.test((b.textContent || '').trim()))
    if (btn) { btn.click(); return (dlg.textContent || '').replace(/\s+/g, ' ').slice(0, 80) }
    return 'dialog-no-btn'
  })
  return handled
}
const st = async () => page.evaluate(() => ({
  status: (document.querySelector('.as-state')?.textContent || '').trim(),
  navStatus: [...document.querySelectorAll('.doc-select-rail tr')].filter((r) => (r.textContent || '').includes('XJ-2026-11-0008')).map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim()),
  auditor: (document.querySelector('.lp-head-right .lp-val')?.textContent || '').trim(),
  msgs: [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').trim()),
  side: [...document.querySelectorAll('.as-side-btn')].map((e) => (e.textContent || '').trim()),
}))
console.log('after pick: ' + JSON.stringify(await st()))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/lp/ego/05-picked.png' })

console.log('click 提交审批 =', await side('提交审批'))
await page.waitForTimeout(700)
console.log('dialog =', JSON.stringify(await confirmDialogs()))
await page.waitForTimeout(3500)
console.log('after submit: ' + JSON.stringify(await st()))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/lp/ego/05-submitted.png' })

console.log('click 审批通过 =', await side('审批通过'))
await page.waitForTimeout(700)
console.log('dialog =', JSON.stringify(await confirmDialogs()))
await page.waitForTimeout(3500)
console.log('after approve: ' + JSON.stringify(await st()))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/lp/ego/05-approved.png' })
await task.finish({ keep: [] })
