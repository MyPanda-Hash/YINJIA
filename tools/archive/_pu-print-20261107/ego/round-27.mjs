// round-27:admin 退出(按管理员布局的账号菜单)→ 供应商 kbl01 登录 → 「打印材料码」弹窗回归 → 恢复 admin
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.waitForTimeout(400)

// ── ① 管理员退出:叶子「系统管理员」→ 向上找下拉触发 → 点菜单「退出」 ──
const adminLogout = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const leaf = [...document.querySelectorAll('*')].find((el) => el.children.length === 0
    && txt(el) === '系统管理员' && el.getBoundingClientRect().width > 0)
  if (!leaf) return 'no admin leaf'
  let node = leaf
  for (let i = 0; i < 6 && node; i++) {
    if (/user|avatar|topbar|account|dropdown|trigger/i.test(node.className || '')) break
    node = node.parentElement
  }
  ;(node || leaf).click()
  return 'opened'
})
console.log('adminLogout=' + adminLogout)
await page.waitForTimeout(1100)
const clickedOut = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').trim()
  const it = [...document.querySelectorAll('.el-dropdown-menu__item, .ctx-item')]
    .find((el) => txt(el) === '退出' || txt(el) === '退出登录')
  if (!it) return false
  it.click()
  return true
})
console.log('adminLogoutClicked=' + clickedOut)
await page.waitForTimeout(3200)
console.log('hash=' + (await page.evaluate(() => location.hash)))

// ── ② 供应商登录 ──
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  const u = ins.find((i) => (i.placeholder || '').includes('账号'))
  const p = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (u) setVal(u, 'kbl01')
  if (p) setVal(p, 'kbl@2026')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(6500)
console.log('supplier=' + JSON.stringify(await page.evaluate(() => {
  const u = JSON.parse(localStorage.getItem('mes_user') || '{}') || {}
  return { hash: location.hash, userName: u.userName, supplierCode: u.supplierCode }
})))

// ── ③ 打开「打印」下拉 → 「打印材料码」──
await page.click('css=.tb-group .tb-caret', { label: 'open print menu (supplier)' })
await page.waitForTimeout(900)
const items = await page.evaluate(() => [...document.querySelectorAll('.ctx-item, .el-dropdown-menu__item')]
  .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(-8))
console.log('items=' + JSON.stringify(items))
await page.click('text=打印材料码', { label: 'open material label dialog (supplier)' })
await page.waitForTimeout(3000)
const dlg = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.mlq')
  if (!root) return { open: false, tail: txt(document.body).slice(-200) }
  return {
    open: true,
    title: txt(document.querySelector('.el-dialog__header')),
    bar: txt(root.querySelector('.mlq-bar')).slice(0, 140),
    rowCount: root.querySelectorAll('.el-table__body tbody tr').length,
    firstRow: txt(root.querySelectorAll('.el-table__body tbody tr')[0]).slice(0, 80),
  }
})
console.log('materialLabel=' + JSON.stringify(dlg, null, 2))
try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-27-supplier-material-label.png' })
  console.log('shot=' + p)
} catch (e) {
  console.log('shot fail: ' + e.message)
  try {
    const res = await page.cdp('Page.captureScreenshot', { format: 'png', fromSurface: false })
    const fs = await import('node:fs/promises')
    const p = 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-27-supplier-material-label.png'
    await fs.writeFile(p, Buffer.from(res.data, 'base64'))
    console.log('raw shot=' + p)
  } catch (e2) { console.log('raw shot fail: ' + e2.message) }
}
// 只关窗,不登记
await page.keyboard.press('Escape')
await page.waitForTimeout(800)

// ── ④ 恢复管理员 ──
await page.click('css=.psb-user', { label: 'open account menu (supplier)' })
await page.waitForTimeout(1000)
await page.click('text=退出登录', { label: 'logout supplier' })
await page.waitForTimeout(3200)
console.log('hash2=' + (await page.evaluate(() => location.hash)))
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  const u = ins.find((i) => (i.placeholder || '').includes('账号'))
  const p = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (u) setVal(u, 'admin')
  if (p) setVal(p, '123456')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(6500)
console.log('restored=' + JSON.stringify(await page.evaluate(() => {
  const u = JSON.parse(localStorage.getItem('mes_user') || '{}') || {}
  return { hash: location.hash, userName: u.userName, isAdmin: u.isAdmin }
})))
