// round-30 — B6 英文界面:菜单/纸面标题/表头不出现裸中文
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]
// 关掉打印预览那个 blob 页签
try { const tabs = await task.tabs(); for (const t of tabs) { if (t.label && t.label !== page.label) await task.page(t.label).close() } } catch (e) {}
async function normalWin() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) {}
}

// 切 en 并刷新
await page.evaluate(() => { try { localStorage.setItem('mes_locale', 'en') } catch (e) {} })
await page.goto('http://localhost:5173/#/dashboard', { timeout: 40000 })
await page.waitForTimeout(2000)
await page.reload({ timeout: 60000 })
await page.waitForTimeout(8000)

// 菜单:悬停 品质管理(英文标题)拿卡片
const menu = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const groups = [...document.querySelectorAll('.leftnav .nav-group')].map((e) => txt(e))
  const grp = [...document.querySelectorAll('.leftnav .nav-group')].find((e) => /Quality/i.test(txt(e)))
  if (grp) grp.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, cancelable: true, view: window }))
  return { groups, hovered: grp ? txt(grp) : null }
})
console.log('MENU_GROUPS=' + JSON.stringify(menu))
await page.waitForTimeout(2000)
const card = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const fc = [...document.querySelectorAll('.fly-card')].find((e) => e.offsetParent !== null)
  return {
    groups: fc ? [...fc.querySelectorAll('.card-group-title')].map((e) => txt(e)) : [],
    items: fc ? [...fc.querySelectorAll('.card-item')].map((e) => txt(e)) : [],
  }
})
console.log('CARD=' + JSON.stringify(card))
const patrolItem = card.items.find((t) => /line patrol/i.test(t))
console.log('PATROL_MENU_EN=' + JSON.stringify(patrolItem || null))
await normalWin()
await page.screenshot({ path: OUT + '/round-30-menu-en.png' })

// 直接进巡线面板(语言已是 en)
await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 40000 })
await page.waitForTimeout(8000)
const clicked = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const tr = [...document.querySelectorAll('.dsr-grid tbody tr')].find((x) => txt(x).includes('XJ-2026-11-0003'))
  if (tr) tr.click()
  return !!tr
})
console.log('OPEN_DOC=' + clicked)
await page.waitForTimeout(7000)
const en = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const sheet = document.querySelector('.lp-sheet')
  const title = txt(document.querySelector('.lp-title'))
  const heads = [...document.querySelectorAll('.lp-grid thead th')].map((e) => txt(e))
  const labels = [...document.querySelectorAll('.lp-label')].map((e) => txt(e))
  const cjk = (s) => /[\u4e00-\u9fff]/.test(s)
  const bad = {
    title: cjk(title) ? title : null,
    headers: heads.filter((h) => cjk(h) && h !== '增删'),
    labels: labels.filter((l) => cjk(l)),
    sideBtns: [...document.querySelectorAll('.as-side-btn')].map((e) => txt(e)).filter((t) => cjk(t)),
  }
  return { locale: localStorage.getItem('mes_locale'), sheet: !!sheet, title, heads, labels, bad }
})
console.log('EN_SHEET=' + JSON.stringify(en, null, 1))
await normalWin()
await page.screenshot({ path: OUT + '/round-30-patrol-en.png', fullPage: true })
// 还原中文
await page.evaluate(() => { try { localStorage.setItem('mes_locale', 'zh-CN') } catch (e) {} })
await fs.writeFile(OUT + '/b6-en.json', JSON.stringify({ menu, card, patrolItem, en }, null, 1), 'utf8')
console.log('DONE round-30')
