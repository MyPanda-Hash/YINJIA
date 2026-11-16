// 2026-11-13 round-03:生产工单页 E2E + 真正的语言切换(顶栏下拉 → English)验 i18n
const task = await taskSpace('wo-dayplan-orig-20261113')
const page = task.page('p1')
const BASE = 'http://127.0.0.1:8091'
const SHOT = 'C:/Users/vigna/ego/wo-dayplan-orig-20261113/'

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

// ── 生产工单页 ────────────────────────────────────────────────
await page.goto(BASE + '/#/prod/plan/workOrderList', { timeout: 40000 })
await page.waitForTimeout(6500)
await restoreWindow()
const list = await page.evaluate(() => {
  const bar = document.querySelector('.wol-short')
  const ths = [...document.querySelectorAll('.wol-table .el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim())
  const rows = [...document.querySelectorAll('.wol-table .el-table__body tr.el-table__row')].map((tr) => {
    const tds = [...tr.querySelectorAll('td')]
    const wono = (tds[1]?.textContent || '').replace(/\s+/g, ' ').trim()
    const cells = tds.map((td, i) => {
      const el = td.querySelector('.dp-plan, .dp-out')
      if (!el) return null
      return { col: ths[i] || String(i), t: (td.textContent || '').replace(/\s+/g, ' ').trim(), cls: el.className, title: el.getAttribute('title') || '' }
    }).filter(Boolean)
    return { wono, cells }
  })
  return {
    rowsShown: rows.length,
    banner: bar ? (bar.textContent || '').replace(/\s+/g, ' ').trim() : '',
    bannerTitle: bar ? (bar.getAttribute('title') || '') : '',
    redCells: document.querySelectorAll('.dp-plan.short').length,
    dateCols: ths.filter((t) => /^\d{2}-\d{2}/.test(t)),
    sample: rows.slice(0, 2),
  }
})
console.log('LIST rowsShown=' + list.rowsShown + ' redCells=' + list.redCells)
console.log('LIST banner=' + JSON.stringify(list.banner))
console.log('LIST bannerTitle=' + JSON.stringify(list.bannerTitle).slice(0, 1500))
console.log('LIST dateCols=' + JSON.stringify(list.dateCols))
console.log('LIST sample=' + JSON.stringify(list.sample).slice(0, 2500))
await page.screenshot({ path: SHOT + 'round-06-wolist.png' })

// ── 语言切换(顶栏下拉,真实路径)──────────────────────────────
const opened = await page.evaluate(() => {
  const el = document.querySelector('.locale-switch')
  if (!el) return 'no-switch'
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return 'clicked:' + (el.textContent || '').trim()
})
await page.waitForTimeout(1200)
const picked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-dropdown-menu__item, .el-dropdown-menu li')]
  const en = items.find((x) => /English/i.test(x.textContent || ''))
  if (en) { en.dispatchEvent(new MouseEvent('click', { bubbles: true })); return 'ok' }
  return 'not-found:' + items.map((x) => (x.textContent || '').trim()).join('|')
})
console.log('locale switch opened=' + opened + ' picked=' + picked)
await page.waitForTimeout(2500)
const enList = await page.evaluate(() => ({
  label: (document.querySelector('.locale-switch') || {}).textContent?.trim() || '',
  bar: (document.querySelector('.wol-short') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
  barTitle: (document.querySelector('.wol-short') || {}).getAttribute?.('title') || '',
  redTitles: [...document.querySelectorAll('.dp-plan.short')].slice(0, 3).map((el) => el.getAttribute('title')),
}))
console.log('EN list=' + JSON.stringify(enList))
await page.screenshot({ path: SHOT + 'round-07-wolist-en.png' })

// 回工单排产页,英文下再看 1号车间(欠产汇总 + 红格 tooltip)
await page.goto(BASE + '/#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(5000)
await restoreWindow()
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith('1号车间'))
  if (el) el.click()
})
await page.waitForTimeout(3500)
const enBoard = await page.evaluate(() => ({
  label: (document.querySelector('.locale-switch') || {}).textContent?.trim() || '',
  bar: (document.querySelector('.wb-short-bar') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
  barTitle: (document.querySelector('.wb-short-bar') || {}).getAttribute?.('title') || '',
  redTitles: [...document.querySelectorAll('.dp-plan.short')].slice(0, 3).map((el) => el.getAttribute('title')),
  headTitle: (document.querySelector('.dp-head') || {}).getAttribute?.('title') || '',
}))
console.log('EN board=' + JSON.stringify(enBoard))
await page.screenshot({ path: SHOT + 'round-08-board-en.png' })

// 切回中文
await page.evaluate(() => {
  const el = document.querySelector('.locale-switch')
  if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(1000)
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-dropdown-menu__item, .el-dropdown-menu li')]
  const zh = items.find((x) => /简体中文/.test(x.textContent || ''))
  if (zh) zh.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(1500)
console.log('back to zh=' + (await page.evaluate(() => (document.querySelector('.locale-switch') || {}).textContent?.trim() || '')))
console.log('DONE')
