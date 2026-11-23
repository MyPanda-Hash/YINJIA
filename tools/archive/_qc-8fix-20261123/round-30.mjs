// round-30: 真鼠标: 侧栏展开 品质管理→制程品质→出货检验（功能）明细表 → 查询
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
const sleep = (ms) => page.waitForTimeout(ms)
const clickText = async (txt, label, idx = 0) => {
  const p = await page.evaluate((txt) => {
    const els = [...document.querySelectorAll('*')].filter((n) => n.children.length === 0 && (n.textContent || '').trim() === txt)
    const el = els[0]
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }
  }, txt)
  if (!p) { console.log('NOT FOUND', txt); return false }
  await page.mouse.click(p.x, p.y, { label })
  await sleep(900)
  return true
}
await clickText('品质管理', 'open quality menu')
await sleep(700)
console.log('after QC menu:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('*')].filter((n) => n.children.length === 0 && ['制程品质', '质量单据', '出货检验（功能）明细表'].includes((n.textContent || '').trim())).map((n) => ({ t: n.textContent.trim(), x: Math.round(n.getBoundingClientRect().x), y: Math.round(n.getBoundingClientRect().y), w: Math.round(n.getBoundingClientRect().width) })))))
await clickText('制程品质', 'open process submenu')
await sleep(900)
console.log('after process submenu:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('*')].filter((n) => n.children.length === 0 && (n.textContent || '').includes('出货检验') && (n.textContent || '').includes('明细表')).map((n) => ({ t: n.textContent.trim(), x: Math.round(n.getBoundingClientRect().x), y: Math.round(n.getBoundingClientRect().y), w: Math.round(n.getBoundingClientRect().width) })))))
await clickText('出货检验（功能）明细表', 'open function detail menu')
await page.waitForTimeout(7000)
console.log('page:', JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400),
  chunk: [...document.querySelectorAll('script')].map((s) => s.src).find((x) => x.includes('index-')),
}))))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-30-menu-detail.png' })
