import fs from 'node:fs/promises'

const OUT = 'C:/Users/Lenovo/ego/purchase-in-source-20261111'
await fs.mkdir(OUT, { recursive: true })

const task = await taskSpace('purchase-in-source-20261111')
const page = task.page('p1')

async function shot(name) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.screenshot({ path: OUT + '/' + name })
  console.log('shot=' + name)
}

// ---- 切登录工厂到正式账套 YINJIA-MES,然后登录 ----
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  const u = ins.find((i) => (i.placeholder || '').includes('登录账号'))
  const p = ins.find((i) => (i.placeholder || '').includes('登录密码'))
  if (u) setVal(u, 'admin')
  if (p) setVal(p, '123456')
})
await page.waitForTimeout(300)

// 打开「登录工厂」下拉,选正式账套(文本恰为 YINJIA-MES,不含「测试库」)
await page.evaluate(() => {
  const sels = [...document.querySelectorAll('.el-select')]
  const fac = sels.find((s) => (s.innerText || '').includes('YINJIA-MES'))
  if (fac) fac.click()
})
await page.waitForTimeout(900)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')]
  .filter((e) => e.offsetParent !== null)
  .map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
console.log('factoryOptions=' + JSON.stringify(opts))

const picked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')].filter((e) => e.offsetParent !== null)
  const prod = items.find((e) => {
    const t = (e.innerText || '').replace(/\s+/g, ' ').trim()
    return t === 'YINJIA-MES' || (t.includes('YINJIA-MES') && !t.includes('测试'))
  })
  if (prod) { prod.click(); return (prod.innerText || '').trim() }
  return null
})
console.log('picked=' + picked)
await page.waitForTimeout(800)

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(5000)

const after = await page.evaluate(() => ({
  hash: location.hash,
  bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
}))
console.log('afterLogin=' + JSON.stringify(after))

await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 40000 })
await page.waitForTimeout(4000)

const list = await page.evaluate(() => ({
  hash: location.hash,
  text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 600),
  queryLabels: [...document.querySelectorAll('.q-item label, .query label, .search label')].map((e) => (e.innerText || '').trim()).slice(0, 20),
}))
console.log('list=' + JSON.stringify(list, null, 2))
await shot('r03-list-prod.png')
