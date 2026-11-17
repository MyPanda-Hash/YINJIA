// 回归补充:①双击行仍能应用 ②未审核路线仍置灰、确定不可点
const task = await taskSpace('order-convert-route-dialog-20261117')
const page = task.page('p1')
const wait = (ms) => page.waitForTimeout(ms)
const D = (fn, ...rest) => (rest.length ? page.evaluate(fn, rest[0]) : page.evaluate(fn))

const snap = () => D(() => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  if (!d) return { dialogOpen: false, msg: txt(document.querySelector('.el-message') || {}) }
  const trs = [...d.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const ok = [...d.querySelectorAll('button')].find((b) => txt(b) === '确定')
  return {
    dialogOpen: true,
    okDisabled: ok ? ok.disabled : null,
    currentRows: trs.filter((tr) => tr.className.includes('current-row')).map((tr) => txt(tr).slice(0, 24)),
  }
})

const openRouteDialog = () => D(() => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const b = [...document.querySelectorAll('button')].find((x) => txt(x).startsWith('选择工艺路线'))
  if (!b || b.disabled) return 'UNAVAILABLE'
  b.click()
  return 'CLICKED'
})

// A) 未审核路线:置灰 → 确定不可点
console.log('OPEN_1', await openRouteDialog())
await wait(1200)
console.log('CLICK_UNAPPROVED', await D(() => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const tr = [...d.querySelectorAll('.el-table__body-wrapper tbody tr')].find((t) => txt(t).includes('未审核'))
  if (!tr) return 'NOT_FOUND'
  tr.querySelectorAll('td')[1].click()
  return txt(tr).slice(0, 24) + ' | class=' + tr.className
}))
await wait(600)
console.log('   state', JSON.stringify(await snap()))

// B) 双击已审核行 → 直接应用(弹窗关闭 + 成功提示)
console.log('DBLCLICK_APPROVED', await D(() => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const tr = [...d.querySelectorAll('.el-table__body-wrapper tbody tr')].find((t) => txt(t).includes('已审核'))
  if (!tr) return 'NOT_FOUND'
  const cell = tr.querySelectorAll('td')[1]
  cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  return txt(tr).slice(0, 30)
}))
await wait(2000)
console.log('   state', JSON.stringify(await snap()))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await wait(300)
} catch (e) {
  console.log('restore skip: ' + e.message)
}
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_order-convert-route-dialog-20261117/verify-04-regression.png' })
console.log('SHOT ok')
