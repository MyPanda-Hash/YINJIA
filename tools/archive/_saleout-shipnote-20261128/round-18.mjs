// round-18:在 **8090(打包版 jar 内 static)** 上把整条链走一遍:登录 → 销售出库单 → 出货单 → 抓打印层
const task = await taskSpace('saleout-shipnote-20261128')
const page = task.page('p1')
const log = (...a) => console.log(...a)

await page.goto('http://127.0.0.1:8090/index.html?r18=' + Date.now(), { timeout: 40000 })
await page.waitForTimeout(4000)
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
await page.goto('http://127.0.0.1:8090/index.html?r18b=' + Date.now(), { timeout: 40000 })
await page.waitForTimeout(4500)

// 登录
await page.evaluate(() => {
  const setVal = (el, v) => {
    if (!el) return
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  setVal(ins.find((i) => (i.placeholder || '').includes('登录账号')), 'admin')
  setVal(ins.find((i) => (i.placeholder || '').includes('登录密码')), '123456')
})
await page.waitForTimeout(400)
const okLogin = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (!btn) return false
  btn.click(); return true
})
log('登录点击=', okLogin)
await page.waitForTimeout(8000)
log('登录后=', JSON.stringify(await page.evaluate(() => ({ hash: location.hash, factory: JSON.parse(localStorage.getItem('mes_factory') || '{}').code }))))

// 面板
await page.evaluate(() => { location.hash = '#/panelx/list/SALE_OUT' })
await page.waitForTimeout(6000)
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const kw = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('模糊搜索'))
  if (kw) setVal(kw, '20261126')
})
await page.waitForTimeout(400)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button, .act-name')].find((b) => (b.textContent || '').trim() === '查找')
  btn?.click()
})
await page.waitForTimeout(3500)
// 选 5 行单
log('选中=', await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((el) => (el.textContent || '').includes('XSCK-20261126-00009'))
  if (!tr) return null
  tr.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)
}))
await page.waitForTimeout(3000)

// 打开打印下拉
await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const nameSpan = [...document.querySelectorAll('span.act-name')].find((el) => t(el) === '打印')
  const group = nameSpan?.closest('.tb-group')
  const caret = group?.querySelector('.tb-caret')
  caret?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  caret?.click?.()
})
await page.waitForTimeout(1200)
const menu = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const m = [...document.querySelectorAll('.tb-menu')].find((el) => el.offsetParent !== null)
  return m ? t(m) : null
})
log('打印下拉=', menu)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { log('restore skip:', e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-18-8090-menu.png' })

// 打桩 → 点出货单
await page.evaluate(() => {
  window.__shipHtml = ''; window.__shipTitle = ''; window.__shipCalled = 0
  window.print = () => {
    window.__shipCalled += 1
    window.__shipHtml = (document.getElementById('yj-print-host') || {}).innerHTML || ''
    window.__shipTitle = document.title
  }
})
const clicked = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const menuEl = [...document.querySelectorAll('.tb-menu')].find((el) => el.offsetParent !== null)
  if (!menuEl) return 'no-menu'
  const hit = [...menuEl.querySelectorAll('*')].filter((el) => t(el) === '出货单').pop()
  if (!hit) return 'no-item'
  hit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  hit.click?.()
  return hit.className || hit.tagName
})
log('点出货单=', clicked)
await page.waitForTimeout(3000)
const out = await page.evaluate(() => ({
  title: window.__shipTitle,
  printCalled: window.__shipCalled,
  htmlLen: (window.__shipHtml || '').length,
  text: (window.__shipHtml || '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
}))
log('打印层=', JSON.stringify(out, null, 2))
const fs = await import('node:fs/promises')
await fs.writeFile('C:/Users/Lenovo/ego/saleout-shipnote-20261128/shipnote-printed-8090.html', await page.evaluate(() => window.__shipHtml || ''), 'utf8')
await page.screenshot({ path: 'C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-18-8090-after.png' })
