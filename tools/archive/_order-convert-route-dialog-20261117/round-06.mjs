// 修复后验证 v2:先切到别的路由(让 OrderConvert 组件卸载 = 状态归零),再进订单结转。
const task = await taskSpace('order-convert-route-dialog-20261117')
const page = task.page('p1')
const wait = (ms) => page.waitForTimeout(ms)

const D = (fn) => page.evaluate(fn)

const snap = () => D(() => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const box = [...document.querySelectorAll('.el-message-box')].find((x) => x.offsetParent !== null)
  const base = { msgBox: box ? txt(box).slice(0, 50) : null }
  if (!d) return { ...base, dialogOpen: false }
  const trs = [...d.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const ok = [...d.querySelectorAll('button')].find((b) => txt(b) === '确定')
  return {
    ...base,
    dialogOpen: true,
    rowCount: trs.length,
    okDisabled: ok ? ok.disabled : null,
    currentRows: trs.filter((tr) => tr.className.includes('current-row')).map((tr) => txt(tr).slice(0, 24)),
  }
})

const clickRow = (pred) => page.evaluate((p) => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  if (!d) return 'NO_DIALOG'
  const tr = [...d.querySelectorAll('.el-table__body-wrapper tbody tr')].find((t) => txt(t).includes(p))
  if (!tr) return 'NOT_FOUND'
  tr.querySelectorAll('td')[1].click()
  return txt(tr).slice(0, 40)
}, pred)

const clickDialogBtn = (label) => page.evaluate((label) => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const b = d && [...d.querySelectorAll('button')].find((x) => txt(x) === label)
  if (!b) return 'NOT_FOUND'
  if (b.disabled) return 'DISABLED'
  b.click()
  return 'CLICKED'
}, label)

const openRouteDialog = () => D(() => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const b = [...document.querySelectorAll('button')].find((x) => txt(x).startsWith('选择工艺路线'))
  if (!b || b.disabled) return 'UNAVAILABLE'
  b.click()
  return 'CLICKED'
})

// 0) 换路由再回来 = 组件重挂载(状态干净)
await page.goto('http://localhost:5173/#/prod/plan/scheduleBoard', { timeout: 30000 })
await wait(2500)
await page.goto('http://localhost:5173/#/prod/plan/orderConvert', { timeout: 30000 })
await wait(4000)
await page.reload()
await wait(7000)

// A) 开页提示:先看有没有 message box,再点「跳转」
const box1 = await D(() => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const box = [...document.querySelectorAll('.el-message-box')].find((x) => x.offsetParent !== null)
  if (!box) return { found: false }
  const buttons = [...box.querySelectorAll('button')].map(txt)
  return { found: true, buttons, text: txt(box).slice(0, 60) }
})
console.log('MSGBOX_1', JSON.stringify(box1))
if (box1.found) {
  const r = await D(() => {
    const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
    const box = [...document.querySelectorAll('.el-message-box')].find((x) => x.offsetParent !== null)
    const b = [...box.querySelectorAll('button')].find((x) => txt(x) === '跳转')
    if (!b) return 'NO_JUMP_BTN'
    b.click()
    return 'CLICKED'
  })
  console.log('MSGBOX_CLICK', r)
  await wait(7000)
}
console.log('AFTER_JUMP', JSON.stringify(await D(() => ({
  rows: document.querySelectorAll('.oc-table .el-table__body-wrapper tbody tr').length,
  boxes: [...document.querySelectorAll('.el-message-box')].filter((x) => x.offsetParent !== null).length,
}))))

// B) 勾第一行
const pick = await D(() => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const tr = document.querySelector('.oc-table .el-table__body-wrapper tbody tr')
  if (!tr) return 'NO_ROWS'
  tr.querySelectorAll('td')[1].click()
  return txt(tr).slice(0, 30)
})
await wait(900)
console.log('PICK_ROW', pick, JSON.stringify(await D(() => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  return { routeBtn: [...document.querySelectorAll('button')].map(txt).find((t) => t.startsWith('选择工艺路线')) }
})))

// C) 第一次打开
console.log('OPEN_1', await openRouteDialog())
await wait(1200)
console.log('   state', JSON.stringify(await snap()))

// D) 选已审核路线 → 确定 → 等关闭
console.log('PICK_1', await clickRow('已审核'))
await wait(500)
console.log('   state', JSON.stringify(await snap()))
console.log('APPLY', await clickDialogBtn('确定'))
await wait(2500)
console.log('AFTER_APPLY', JSON.stringify(await snap()))

// E) 重新打开
console.log('OPEN_2', await openRouteDialog())
await wait(1500)
console.log('   state', JSON.stringify(await snap(), null, 2))

// F) 关键:点同一条路线
console.log('PICK_SAME', await clickRow('已审核'))
await wait(600)
console.log('   state', JSON.stringify(await snap(), null, 2))

// G) 取消
console.log('CANCEL', await clickDialogBtn('取消'))
await wait(1800)
console.log('FINAL', JSON.stringify(await snap()))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await wait(300)
} catch (e) {
  console.log('restore skip: ' + e.message)
}
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_order-convert-route-dialog-20261117/verify-03-clean.png' })
console.log('SHOT ok')
