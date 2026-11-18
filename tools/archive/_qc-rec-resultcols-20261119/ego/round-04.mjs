// round-04:减列 7 → 6(确认弹窗 → 清空被减列)→ 保存 → 刷新,确认列数与被减列的值都清了
const task = await taskSpace('qc-insp-rec-resultcols-20261119')
const page = task.page('p1')

const dump = async (tag) => {
  const st = await page.evaluate(() => ({
    stepperNum: document.querySelector('.qr-colstep-num')?.textContent?.trim() ?? null,
    headCells: [...document.querySelectorAll('.qr-table thead tr:nth-child(2) th')].map((el) => (el.textContent || '').trim()),
    values: [...document.querySelectorAll('.qr-table tbody tr:first-child td.c-res input')].map((i) => i.value),
    readOnlyTexts: [...document.querySelectorAll('.qr-table tbody tr:first-child td.c-res .qr-cell-text')].map((i) => (i.textContent || '').trim()),
    dialog: document.querySelector('.el-message-box') ? (document.querySelector('.el-message-box__message')?.textContent || '').trim() : null,
  }))
  console.log(tag + ' ' + JSON.stringify(st))
  return st
}
await dump('pre')

// 1) 点「－」→ 应弹确认框
await page.click('.qr-colstep > span:nth-child(2)', { label: '减少检测结果列' })
await page.waitForTimeout(1200)
await dump('dialog-open')
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-20261119/round-04-confirm.png' })

// 2) 点「确定」
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box__btns button')]
    .find((x) => (x.textContent || '').trim() === '确定')
  if (b) b.click()
})
await page.waitForTimeout(1200)
await dump('after-confirm')

// 3) 保存为草稿 → 刷新重取
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === '保存为草稿')
  if (b) b.click()
})
await page.waitForTimeout(3000)
await page.reload({ timeout: 40000 })
await page.waitForTimeout(4000)
await dump('after-reload')

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-20261119/round-04.png' })
