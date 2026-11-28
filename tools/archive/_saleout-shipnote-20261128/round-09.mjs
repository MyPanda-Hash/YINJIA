// round-09:选 5 行那单据 → 看「打印」下拉项 → 打桩 window.print → 点「出货单」→ 抓打印层 HTML
const task = await taskSpace('saleout-shipnote-20261128')
const page = task.page('p1')
const log = (...a) => console.log(...a)
const txt = (s) => (s || '').replace(/\s+/g, ' ').trim()

// 1) 左列表点一张 5 行单(XSCK-20261126-00009)
const picked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body tr')]
  const row = rows.find((el) => (el.textContent || '').includes('XSCK-20261126-00009'))
  if (!row) return null
  row.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return (row.textContent || '').replace(/\s+/g, ' ').trim()
})
log('选中行=', picked)
await page.waitForTimeout(3000)

const afterPick = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    docNo: t(document.querySelector('.doc-nohint, .doc-no, .panel-docno')),
    detailRows: [...document.querySelectorAll('.detail .el-table__body tr')].map(t).slice(0, 8),
    buttons: [...document.querySelectorAll('button')].map(t).filter(Boolean).slice(0, 30),
  }
})
log('选中后=', JSON.stringify(afterPick, null, 2))

// 2) 点「打印」组的下拉箭头,抓下拉项
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const grp = btns.find((b) => (b.textContent || '').trim().startsWith('打印'))
  // 下拉箭头通常是同组内的 .el-dropdown 触发元素
  const dd = grp?.closest('.el-dropdown') || grp?.parentElement
  const caret = dd?.querySelector('.el-dropdown__caret-button, .el-dropdown__icon, .caret')
  ;(caret || dd)?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  ;(caret || dd)?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(1500)
const menu = await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item, .el-popper .el-dropdown-menu li')]
  .filter((el) => el.offsetParent !== null)
  .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()))
log('打印下拉项=', JSON.stringify(menu))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-09-menu.png' })

// 3) 打桩 window.print + 点「出货单」
await page.evaluate(() => {
  window.__shipHtml = ''
  window.__shipTitle = ''
  window.print = () => {
    window.__shipHtml = (document.getElementById('yj-print-host') || {}).innerHTML || ''
    window.__shipTitle = document.title
  }
})
const clicked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-dropdown-menu__item')].filter((el) => el.offsetParent !== null)
  const hit = items.find((el) => (el.textContent || '').trim() === '出货单')
  if (!hit) return false
  hit.click(); return true
})
log('点「出货单」=', clicked)
await page.waitForTimeout(2500)
const out = await page.evaluate(() => ({
  title: window.__shipTitle,
  hostMounted: !!document.getElementById('yj-print-host'),
  htmlLen: (window.__shipHtml || '').length,
  htmlHead: (window.__shipHtml || '').slice(0, 600),
}))
log('打印层=', JSON.stringify(out, null, 2))
// 存下来供离线渲染核对
const html = await page.evaluate(() => window.__shipHtml || '')
const fs = await import('node:fs/promises')
await fs.writeFile('C:/Users/Lenovo/ego/saleout-shipnote-20261128/shipnote-printed.html', html, 'utf8')
await page.screenshot({ path: 'C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-09-after-click.png' })
