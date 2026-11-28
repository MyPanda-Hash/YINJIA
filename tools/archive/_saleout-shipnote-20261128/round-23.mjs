// round-23:8090(打包版)按真实按钮打 XSCK-20270901-00001 的出货单,抓打印层并放大页脚核对
const task = await taskSpace('saleout-shipnote-20261128')
const page = task.page('p1')
const log = (...a) => console.log(...a)
const fs = await import('node:fs/promises')

await page.goto('http://127.0.0.1:8090/index.html?r23=' + Date.now(), { timeout: 40000 })
await page.waitForTimeout(4500)
if (!(await page.evaluate(() => !!localStorage.getItem('mes_token')))) {
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
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))?.click())
  await page.waitForTimeout(8000)
}

await page.evaluate(() => { location.hash = '#/panelx/list/SALE_OUT' })
await page.waitForTimeout(6500)
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const kw = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('模糊搜索'))
  if (kw) setVal(kw, '20270901')
})
await page.waitForTimeout(400)
await page.evaluate(() => {
  [...document.querySelectorAll('button, .act-name')].find((b) => (b.textContent || '').trim() === '查找')?.click()
})
await page.waitForTimeout(3500)
log('选中=', await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((el) => (el.textContent || '').includes('XSCK-20270901'))
  if (!tr) return null
  tr.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)
}))
await page.waitForTimeout(3000)

await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const group = [...document.querySelectorAll('span.act-name')].find((el) => t(el) === '打印')?.closest('.tb-group')
  const caret = group?.querySelector('.tb-caret')
  caret?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); caret?.click?.()
})
await page.waitForTimeout(1100)
await page.evaluate(() => {
  window.__shipHtml = ''
  window.print = () => { window.__shipHtml = (document.getElementById('yj-print-host') || {}).innerHTML || '' }
})
await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const menu = [...document.querySelectorAll('.tb-menu')].find((el) => el.offsetParent !== null)
  const hit = [...(menu?.querySelectorAll('*') || [])].filter((el) => t(el) === '出货单').pop()
  hit?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); hit?.click?.()
})
await page.waitForTimeout(2500)
const html = await page.evaluate(() => window.__shipHtml || '')
log('打印层长度=', html.length)
log('文本=', html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
await fs.writeFile('C:/Users/Lenovo/ego/saleout-shipnote-20261128/shipnote-fixed-8090.html',
  `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff">${html}</body>`, 'utf8')

// 在同一页渲染成打印媒体并放大页脚
await page.goto('file:///C:/Users/Lenovo/ego/saleout-shipnote-20261128/shipnote-fixed-8090.html', { timeout: 30000 })
await page.waitForTimeout(700)
await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.waitForTimeout(500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { log('restore skip:', e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-23-full.png', fullPage: true })
const geo = await page.evaluate(() => {
  const r = (sel) => { const el = document.querySelector(sel); const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom } }
  return { table: r('table'), copies: r('.copies') }
})
const res = await page.cdp('Page.captureScreenshot', {
  format: 'png',
  clip: { x: 0, y: Math.max(0, geo.table.bottom - 6), width: 1000, height: Math.max(60, geo.copies.bottom - geo.table.bottom + 16), scale: 4 },
})
await fs.writeFile('C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-23-footer-x4.png', Buffer.from(res.data, 'base64'))
log('x4 保存完成')
