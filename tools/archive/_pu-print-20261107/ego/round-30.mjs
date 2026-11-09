// round-30:供应商账号(kbl01)实测打印记录:打印→记录出现→重打次数+1→作废消失;测完恢复 admin
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.waitForTimeout(400)

// ① admin 退出(真实点账号菜单 → 退出)
const opened = await page.evaluate(() => {
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
console.log(opened)
await page.waitForTimeout(1000)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.el-dropdown-menu__item, .ctx-item')]
    .find((el) => ['退出', '退出登录'].includes((el.textContent || '').trim()))
  if (it) it.click()
})
await page.waitForTimeout(3000)

// ② 供应商登录
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'kbl01')
  setVal(ins.find((i) => (i.placeholder || '').includes('密码')), 'kbl@2026')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(6500)
console.log('supplier=' + JSON.stringify(await page.evaluate(() => {
  const u = JSON.parse(localStorage.getItem('mes_user') || '{}') || {}
  return { hash: location.hash, userName: u.userName, supplierCode: u.supplierCode }
})))

// ③ 选中 7 行订单 → 开打印弹窗
await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const row = [...document.querySelectorAll('tbody tr')].find((r) => txt(r).includes('YJ-20261012-11') && r.getBoundingClientRect().height > 0)
  if (row) { row.scrollIntoView({ block: 'center' }); row.click() }
})
await page.waitForTimeout(2500)
await page.evaluate(() => {
  window.__printCalls = 0
  if (!window.__origPrint) window.__origPrint = window.print
  window.print = () => { window.__printCalls += 1 }
})
await page.click('css=.tb-group .tb-main:has-text("打印")', { label: 'open print dialog (supplier)' })
await page.waitForSelector('.pup', { state: 'visible', timeout: 15000 })
await page.waitForTimeout(1500)

const initial = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  return {
    recRows: root.querySelectorAll('.pup-rec .el-table__body tbody tr').length,
    recEmpty: txt(root.querySelector('.pup-rec .el-table__empty-text')),
    checked: root.querySelectorAll('.pup > .el-table .el-table__body .el-checkbox.is-checked').length,
  }
})
console.log('supplierInitial=' + JSON.stringify(initial))

// ④ 编辑并打印
await page.click('css=.pup > .el-table .el-table__body tbody tr .el-checkbox >> nth=1', { label: 'uncheck line 2 (supplier)' })
await page.click('css=.pup > .el-table .el-input-number input >> nth=0', { label: 'focus qty (supplier)' })
await page.keyboard.press('ControlOrMeta+a')
await page.keyboard.type('1234')
await page.keyboard.press('Tab')
await page.waitForTimeout(600)
await page.click('text=确定并打印', { label: 'confirm print (supplier)' })
await page.waitForTimeout(2200)
const paper = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const host = document.getElementById('yj-print-host')
  return {
    present: !!host,
    rows: host ? host.querySelectorAll('tbody tr').length : 0,
    total: host ? txt(host.querySelector('tbody tr.sum')) : '',
    toast: [...document.querySelectorAll('.el-message')].map(txt).filter(Boolean).slice(-2),
  }
})
console.log('supplierPaper=' + JSON.stringify(paper))
await page.evaluate(() => { window.dispatchEvent(new Event('afterprint')) })
await page.waitForTimeout(2000)

const afterPrint = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.pup-rec .el-table__body tbody tr')]
  return { recRows: rows.length, rec: rows.map(txt) }
})
console.log('supplierAfterPrint=' + JSON.stringify(afterPrint, null, 2))
try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-30-supplier-record.png' })
  console.log('shot=' + p)
} catch (e) {
  console.log('shot fail: ' + e.message)
  try {
    const res = await page.cdp('Page.captureScreenshot', { format: 'png', fromSurface: false })
    const fs = await import('node:fs/promises')
    const p = 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-30-supplier-record.png'
    await fs.writeFile(p, Buffer.from(res.data, 'base64'))
    console.log('raw shot=' + p)
  } catch (e2) { console.log('raw shot fail: ' + e2.message) }
}

// ⑤ 重打
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.pup-rec .el-table__body tbody tr button')].find((b) => (b.textContent || '').trim() === '重打')
  if (btn) btn.click()
})
await page.waitForTimeout(2200)
await page.evaluate(() => { window.dispatchEvent(new Event('afterprint')) })
await page.waitForTimeout(2000)
console.log('supplierAfterReprint=' + JSON.stringify(await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    rec: [...document.querySelectorAll('.pup-rec .el-table__body tbody tr')].map(txt),
    toast: [...document.querySelectorAll('.el-message')].map(txt).filter(Boolean).slice(-2),
  }
}), null, 2))

// ⑥ 作废
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.pup-rec .el-table__body tbody tr button')].find((b) => (b.textContent || '').trim() === '作废')
  if (btn) btn.click()
})
await page.waitForTimeout(900)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.el-message-box__btns button')].find((b) => (b.textContent || '').trim() === '确定')
  if (btn) btn.click()
})
await page.waitForTimeout(2000)
console.log('supplierAfterVoid=' + JSON.stringify(await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  return {
    recRows: root.querySelectorAll('.pup-rec .el-table__body tbody tr').length,
    recEmpty: txt(root.querySelector('.pup-rec .el-table__empty-text')),
    toast: [...document.querySelectorAll('.el-message')].map(txt).filter(Boolean).slice(-2),
  }
}), null, 2))

// 关闭弹窗 + 还原 print
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
await page.evaluate(() => {
  if (window.__origPrint) window.print = window.__origPrint
  document.getElementById('yj-print-host')?.remove()
  document.getElementById('yj-print-host-css')?.remove()
})
