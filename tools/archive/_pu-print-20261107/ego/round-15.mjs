// round-15:验证 8090(jar 内 static)也已生效 —— 登录 → 采购订单 → 打印弹窗
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/login', { timeout: 50000 })
await page.waitForTimeout(3500)

const atLogin = await page.evaluate(() => {
  const ins = [...document.querySelectorAll('input')]
  return location.hash.includes('/login') || ins.some((i) => (i.placeholder || '').includes('账号'))
})
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
  await page.waitForTimeout(5000)
}
await page.goto('http://127.0.0.1:8090/#/panelx/list/PU_ORDER', { timeout: 50000 })
await page.waitForTimeout(6000)

// 选 YJ-20261012-11(第一页第 11 行)
const clicked = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const row = [...document.querySelectorAll('tbody tr')].find((r) => txt(r).includes('YJ-20261012-11') && r.getBoundingClientRect().height > 0)
  if (!row) return 'row not found'
  row.scrollIntoView({ block: 'center' })
  row.click()
  return 'selected'
})
console.log(clicked)
await page.waitForTimeout(2500)

const opened = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tb-group .tb-main')].find((n) => (n.textContent || '').trim() === '打印')
  if (!el) return 'no print button'
  el.click()
  return 'clicked print'
})
console.log(opened)
await page.waitForTimeout(3000)

const dlg = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  return {
    open: !!root,
    title: txt(document.querySelector('.el-dialog__header')),
    headers: root ? [...root.querySelectorAll('.el-table__header th')].map(txt) : [],
    rowCount: root ? root.querySelectorAll('.el-table__body tbody tr').length : 0,
    foot: root ? txt(root.querySelector('.pup-foot')) : '',
    entryScript: [...document.querySelectorAll('script[src]')].map((s) => s.src).filter((s) => s.includes('index-')).slice(0, 3),
  }
})
console.log(JSON.stringify(dlg, null, 2))
try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-15-8090.png' })
  console.log('shot=' + p)
} catch (e) {
  console.log('shot fail: ' + e.message)
  try {
    const res = await page.cdp('Page.captureScreenshot', { format: 'png', fromSurface: false })
    const fs = await import('node:fs/promises')
    const p = 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-15-8090.png'
    await fs.writeFile(p, Buffer.from(res.data, 'base64'))
    console.log('raw shot=' + p)
  } catch (e2) { console.log('raw shot fail: ' + e2.message) }
}
await page.keyboard.press('Escape')
