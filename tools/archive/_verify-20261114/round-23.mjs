// round-23 — 放大窗口 → 看左导航菜单 → 点「巡线检验」进页面(B1 点击路径)
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1680, height: 1000 } })
  }
} catch (e) { console.log('resize skip ' + e.message) }
await page.waitForTimeout(800)
await page.goto('http://localhost:5173/#/dashboard', { timeout: 40000 })
await page.waitForTimeout(7000)

const outline = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const walk = (el, depth, arr) => {
    if (depth > 3 || !el) return
    for (const c of el.children) {
      const cls = String(c.className || '')
      const t = txt(c)
      if (t) arr.push({ d: depth, tag: c.tagName, cls: cls.slice(0, 70), t: t.slice(0, 60) })
      walk(c, depth + 1, arr)
    }
  }
  const arr = []
  walk(document.body, 0, arr)
  const hits = []
  const walkAll = (el) => {
    if (!el) return
    if (txt(el) === '巡线检验') hits.push({ tag: el.tagName, cls: String(el.className), vis: el.offsetParent !== null, parent: el.parentElement ? { tag: el.parentElement.tagName, cls: String(el.parentElement.className), t: txt(el.parentElement).slice(0, 80) } : null })
    for (const c of el.children) walkAll(c)
  }
  walkAll(document.body)
  return {
    hash: location.hash,
    width: window.innerWidth,
    outline: arr.filter((x) => /menu|nav|sidebar|aside|tab|breadcrumb/i.test(x.cls) || x.t.length < 12).slice(0, 60),
    hits,
    allTextHasPatrol: txt(document.body).includes('巡线检验'),
  }
})
console.log('OUTLINE=' + JSON.stringify(outline, null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: OUT + '/round-23-dashboard.png' })
console.log('DONE round-23')
