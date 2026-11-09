// round-19:真实点击退出 → 用供应商账号 kbl01 登录 → 确认只剩「供应商采购打印」
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('bounds: ' + e.message) }

await page.goto('http://localhost:5173/#/dashboard', { timeout: 40000 })
await page.waitForTimeout(3500)

// 顶部右上角账号菜单:找一个可见元素,其文本包含「系统管理员」
const menuInfo = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const hits = [...document.querySelectorAll('*')].filter((el) => el.children.length === 0 && /系统管理员|admin/.test(txt(el)))
  return hits.map((el) => {
    const b = el.getBoundingClientRect()
    return { text: txt(el).slice(0, 30), cls: el.className, w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top), left: Math.round(b.left) }
  }).filter((x) => x.w > 0 && x.h > 0).slice(0, 8)
})
console.log('userEntry=' + JSON.stringify(menuInfo, null, 2))

// 点账号区(带下拉),再点「退出」
const opened = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const hits = [...document.querySelectorAll('*')].filter((el) => el.children.length === 0 && txt(el) === '系统管理员')
  const leaf = hits.find((el) => el.getBoundingClientRect().width > 0)
  if (!leaf) return 'no user leaf'
  // 向上找带下拉触发样式的祖先
  let node = leaf
  for (let i = 0; i < 6 && node; i++) {
    if (/user|avatar|topbar|account|dropdown/i.test(node.className || '')) break
    node = node.parentElement
  }
  ;(node || leaf).click()
  return 'clicked ' + (node || leaf).className
})
console.log(opened)
await page.waitForTimeout(1200)

const items = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return [...document.querySelectorAll('.el-dropdown-menu__item, .ctx-item, [class*="menu-item"]')].map(txt).filter(Boolean).slice(0, 40)
})
console.log('menuItems=' + JSON.stringify(items))
const loggedOut = await page.evaluate(() => {
  const it = [...document.querySelectorAll('.el-dropdown-menu__item, .ctx-item, [class*="menu-item"]')].find((el) => (el.textContent || '').trim() === '退出')
  if (!it) return 'no logout item'
  it.click()
  return 'clicked logout'
})
console.log(loggedOut)
await page.waitForTimeout(3500)
console.log('after logout hash=' + (await page.evaluate(() => location.hash)))

// 供应商账号登录(真实填表 + 点按)
const loginState = await page.evaluate(() => {
  const ins = [...document.querySelectorAll('input')]
  return {
    hash: location.hash,
    fields: ins.map((i) => i.placeholder || i.type).slice(0, 10),
  }
})
console.log('loginPage=' + JSON.stringify(loginState))

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
await page.waitForTimeout(6000)

const sup = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const u = JSON.parse(localStorage.getItem('mes_user') || '{}') || {}
  return {
    hash: location.hash,
    userName: u.userName,
    supplierCode: u.supplierCode,
    isAdmin: u.isAdmin,
    nav: [...document.querySelectorAll('.left-nav a, .menu-item, nav a')].map(txt).filter(Boolean).slice(0, 25),
    bodyTop: txt(document.body).slice(0, 200),
  }
})
console.log('supplierSession=' + JSON.stringify(sup, null, 2))
try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-19-supplier-login.png' })
  console.log('shot=' + p)
} catch (e) {
  console.log('shot fail: ' + e.message)
  try {
    const res = await page.cdp('Page.captureScreenshot', { format: 'png', fromSurface: false })
    const fs = await import('node:fs/promises')
    const p = 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-19-supplier-login.png'
    await fs.writeFile(p, Buffer.from(res.data, 'base64'))
    console.log('raw shot=' + p)
  } catch (e2) { console.log('raw shot fail: ' + e2.message) }
}
