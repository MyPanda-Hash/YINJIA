// round-35:登录 admin → 打开采购订单 → 开打印弹窗(确认系统与打印记录功能都在)
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.waitForTimeout(500)

const atLogin = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号')))
if (atLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(7000)
}
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(6000)

const pageInfo = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const u = JSON.parse(localStorage.getItem('mes_user') || '{}') || {}
  return {
    hash: location.hash,
    title: document.title,
    user: u.userName,
    rows: [...document.querySelectorAll('tbody tr')].length,
    toolbar: [...document.querySelectorAll('.tb-group')].map(txt),
  }
})
console.log('page=' + JSON.stringify(pageInfo, null, 2))

// 选中 7 行订单 → 打开打印弹窗
await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const row = [...document.querySelectorAll('tbody tr')].find((r) => txt(r).includes('YJ-20261012-11') && r.getBoundingClientRect().height > 0)
  if (row) { row.scrollIntoView({ block: 'center' }); row.click() }
})
await page.waitForTimeout(2500)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tb-group .tb-main')].find((n) => (n.textContent || '').trim() === '打印')
  if (el) el.click()
})
await page.waitForTimeout(2500)
const dlg = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  return {
    open: !!root,
    title: txt(document.querySelector('.el-dialog__header')),
    rows: root ? root.querySelectorAll('.pup > .el-table .el-table__body tbody tr').length : 0,
    recTitle: root ? txt(root.querySelector('.pup-rec-title')) : '',
    recEmpty: root ? txt(root.querySelector('.pup-rec .el-table__empty-text')) : '',
  }
})
console.log('dialog=' + JSON.stringify(dlg, null, 2))
try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-35-system.png' })
  console.log('shot=' + p)
} catch (e) { console.log('shot fail: ' + e.message) }
await page.keyboard.press('Escape')
