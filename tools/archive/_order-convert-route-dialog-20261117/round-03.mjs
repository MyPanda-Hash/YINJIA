// 复现(精确版):只用「已审核」路线。第一次选中并确定 → 第二次打开:旧行仍是 current-row 但确定禁用;
// 再点同一条路线仍禁用;点别的再点回来才恢复。
const task = await taskSpace('order-convert-route-dialog-20261117')
const page = task.page('p1')
const wait = (ms) => page.waitForTimeout(ms)

const snap = () => page.evaluate(() => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  if (!d) return { dialogOpen: false }
  const trs = [...d.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const ok = [...d.querySelectorAll('button')].find((b) => txt(b) === '确定')
  return {
    dialogOpen: true,
    okDisabled: ok ? ok.disabled : null,
    currentRows: trs.filter((tr) => tr.className.includes('current-row')).map((tr) => txt(tr).slice(0, 22)),
    approved: trs.map((tr) => txt(tr).slice(0, 22)).filter((t) => t.includes('已审核')),
  }
})

const clickRow = (pred) => page.evaluate((p) => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const trs = [...d.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const tr = trs.find((t) => txt(t).includes(p))
  if (!tr) return 'NOT_FOUND'
  tr.querySelectorAll('td')[1].click()
  return txt(tr).slice(0, 40)
}, pred)

// 收尾:先关掉上一轮可能开着的弹窗
await page.evaluate(() => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const cancel = d && [...d.querySelectorAll('button')].find((b) => txt(b) === '取消')
  if (cancel) cancel.click()
})
await wait(800)

// A) 打开 → 点「已审核」路线 → 确定
await page.evaluate(() => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const b = [...document.querySelectorAll('button')].find((x) => txt(x).startsWith('选择工艺路线'))
  if (b) b.click()
})
await wait(1200)
console.log('OPEN_1', JSON.stringify(await snap()))
const clicked1 = await clickRow('已审核')
await wait(600)
console.log('PICK_APPROVED_1', clicked1, JSON.stringify(await snap()))

await page.evaluate(() => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const ok = d && [...d.querySelectorAll('button')].find((b) => txt(b) === '确定')
  if (ok && !ok.disabled) ok.click()
})
await wait(1500)
console.log('AFTER_APPLY_1', JSON.stringify(await snap()))
console.log('ROW_ROUTE', JSON.stringify(await page.evaluate(() => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const tr = document.querySelector('.oc-table .el-table__body-wrapper tbody tr')
  return txt(tr).slice(-40)
})))

// B) 第二次打开(同一行仍勾着)→ 观察"默认选中"与确定可用性
await page.evaluate(() => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const b = [...document.querySelectorAll('button')].find((x) => txt(x).startsWith('选择工艺路线'))
  if (b) b.click()
})
await wait(1200)
const open2 = await snap()
console.log('OPEN_2', JSON.stringify(open2, null, 2))

// C) 点"同一条"已审核路线 → 确定是否可点
const clicked2 = await clickRow('已审核')
await wait(600)
const afterSame = await snap()
console.log('PICK_SAME', clicked2, JSON.stringify(afterSame, null, 2))

// D) 对照组:点别的路线,再点回同一条
const clickedOther = await clickRow('GY-2026-10-0006')
await wait(600)
console.log('PICK_OTHER', clickedOther, JSON.stringify(await snap()))
const clickedBack = await clickRow('已审核')
await wait(600)
console.log('PICK_BACK_SAME', clickedBack, JSON.stringify(await snap()))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await wait(300)
} catch (e) {
  console.log('restore skip: ' + e.message)
}
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_order-convert-route-dialog-20261117/repro-03-dialog-same-row.png' })
console.log('SHOT ok')
