// round-15:打桩 window.print → 点「出货单」→ 抓打印层 HTML(端到端:真按钮、真取数)
const task = await taskSpace('saleout-shipnote-20261128')
const page = task.page('p1')
const log = (...a) => console.log(...a)

await page.evaluate(() => {
  window.__shipHtml = ''
  window.__shipTitle = ''
  window.__shipCalled = 0
  window.print = () => {
    window.__shipCalled += 1
    window.__shipHtml = (document.getElementById('yj-print-host') || {}).innerHTML || ''
    window.__shipTitle = document.title
  }
})

const clicked = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const menu = [...document.querySelectorAll('.tb-menu')].find((el) => el.offsetParent !== null)
  if (!menu) return 'no-menu'
  const hit = [...menu.querySelectorAll('*')].filter((el) => t(el) === '出货单').pop()
  if (!hit) return 'no-item'
  hit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  hit.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  hit.click?.()
  return `clicked ${hit.tagName}.${hit.className}`
})
log('点出货单 =', clicked)
await page.waitForTimeout(3500)

const out = await page.evaluate(() => ({
  title: window.__shipTitle,
  printCalled: window.__shipCalled,
  hostMounted: !!document.getElementById('yj-print-host'),
  htmlLen: (window.__shipHtml || '').length,
  text: (window.__shipHtml || '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
}))
log('打印层=', JSON.stringify(out, null, 2))
const html = await page.evaluate(() => window.__shipHtml || '')
const fs = await import('node:fs/promises')
await fs.writeFile('C:/Users/Lenovo/ego/saleout-shipnote-20261128/shipnote-printed.html', html, 'utf8')
log('已存 html 长度=', html.length)
await page.screenshot({ path: 'C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-15-after-print.png' })
