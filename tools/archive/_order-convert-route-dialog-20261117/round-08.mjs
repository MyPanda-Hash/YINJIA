// 双击行应用(真实指针事件):先选一条已审核路线所在行,双击它 → 弹窗应关闭并提示"已为 N 行设置工艺路线"
const task = await taskSpace('order-convert-route-dialog-20261117')
const page = task.page('p1')
const wait = (ms) => page.waitForTimeout(ms)

// 当前弹窗应仍开着(上一轮选的 GY-001 未审核,确定不可点);找已审核行的下标
const idx = await page.evaluate(() => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  if (!d) return -1
  const trs = [...d.querySelectorAll('.el-table__body-wrapper tbody tr')]
  return trs.findIndex((t) => txt(t).includes('已审核'))
})
console.log('APPROVED_ROW_INDEX', idx)

const sel = `.el-dialog .el-table__body-wrapper tbody tr:nth-child(${idx + 1}) td:nth-child(2)`
await page.dblclick(sel, { label: '双击已审核路线' })
await wait(2000)

console.log('AFTER_DBLCLICK', JSON.stringify(await page.evaluate(() => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  return {
    dialogOpen: !!d,
    msg: txt(document.querySelector('.el-message') || {}),
    rowRoute: txt(document.querySelector('.oc-table .el-table__body-wrapper tbody tr') || {}).slice(-30),
  }
}), null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await wait(300)
} catch (e) {
  console.log('restore skip: ' + e.message)
}
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_order-convert-route-dialog-20261117/verify-04-regression.png' })
console.log('SHOT ok')
