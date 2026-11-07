// round-29:作废打印记录(确认框 → 记录消失)
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.waitForTimeout(400)

const before = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.pup-rec .el-table__body tbody tr')]
  return { open: !!document.querySelector('.pup'), rec: rows.map(txt) }
})
console.log('before=' + JSON.stringify(before, null, 2))

const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.pup-rec .el-table__body tbody tr button')].find((b) => (b.textContent || '').trim() === '作废')
  if (!btn) return false
  btn.click()
  return true
})
console.log('clickedVoid=' + clicked)
await page.waitForTimeout(1000)
const box = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    visible: !!document.querySelector('.el-message-box'),
    title: txt(document.querySelector('.el-message-box__title')),
    msg: txt(document.querySelector('.el-message-box__message')).slice(0, 200),
  }
})
console.log('confirmBox=' + JSON.stringify(box, null, 2))

const confirmed = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.el-message-box__btns button')].find((b) => (b.textContent || '').trim() === '确定')
  if (!btn) return false
  btn.click()
  return true
})
console.log('confirmed=' + confirmed)
await page.waitForTimeout(2000)
const after = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  return {
    recRows: root.querySelectorAll('.pup-rec .el-table__body tbody tr').length,
    recEmpty: txt(root.querySelector('.pup-rec .el-table__empty-text')),
    toast: [...document.querySelectorAll('.el-message')].map(txt).filter(Boolean).slice(-2),
  }
})
console.log('after=' + JSON.stringify(after, null, 2))
try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-29-void.png' })
  console.log('shot=' + p)
} catch (e) { console.log('shot fail: ' + e.message) }

// 收尾:关弹窗 + 还原 window.print
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
await page.evaluate(() => {
  if (window.__origPrint) window.print = window.__origPrint
  document.getElementById('yj-print-host')?.remove()
  document.getElementById('yj-print-host-css')?.remove()
})
