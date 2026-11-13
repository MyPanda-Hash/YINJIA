// 2026-11-13 round-02:E2E —— 8091 新 jar(新前端+新后端),工单排产页「原计划/报工」+ 欠产标红/顶部汇总
// 数据基线(接口对账,2026-11-13):
//   3号车间:GD-2026-11-0017 原计划{11-13:715} 日报工{11-13:15} 日计划{11-13:700} ⇒ 今天格应显示 715/15(绿色,不算欠产)
//   1号车间:GD-2026-11-0012 原计划{11-11:834,11-12:833} 日报工{11-11:500,11-12:100} ⇒ 2 处欠产,合计 1067(334+733)
//   2号车间:3 行历史欠产 25 处,合计 10235(多数日期不在日期列内 —— 边界样本)
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

async function loginIfNeeded() {
  await page.goto(BASE + '/#/prod/plan/workOrderBoard', { timeout: 40000 })
  await page.waitForTimeout(5000)
  const need = await page.evaluate(() => !!document.querySelector('input[type="password"], input[placeholder*="密码"]'))
  if (!need) return
  console.log('login required → auto login')
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')) ?? ins[0], 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')) ?? ins[1], '123456')
    document.querySelector('.login-form .el-select')?.click()
  })
  await page.waitForTimeout(1200)
  const picked = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')]
    const el = items.find((x) => { const t = (x.textContent || '').trim(); return t.includes('YINJIA-MES') && !t.includes('测试') })
    if (el) { el.click(); return (el.textContent || '').trim() }
    return 'not-found'
  })
  console.log('factory=' + picked)
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
  await page.goto(BASE + '/#/prod/plan/workOrderBoard', { timeout: 40000 })
  await page.waitForTimeout(5000)
}

async function readBoard() {
  return page.evaluate(() => {
    const bar = document.querySelector('.wb-short-bar')
    const ths = [...document.querySelectorAll('.wb-main .el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim())
    const rows = [...document.querySelectorAll('.wb-main .el-table__body tr.el-table__row')].map((tr) => {
      const tds = [...tr.querySelectorAll('td')]
      const wono = (tds[1]?.textContent || '').replace(/\s+/g, ' ').trim()
      const cells = tds.map((td, i) => {
        const el = td.querySelector('.dp-plan, .dp-out')
        if (!el) return null
        return {
          col: ths[i] || String(i), t: (td.textContent || '').replace(/\s+/g, ' ').trim(),
          cls: el.className, color: getComputedStyle(el).color, title: el.getAttribute('title') || '',
        }
      }).filter(Boolean)
      return { wono, cells }
    })
    return {
      banner: bar ? (bar.textContent || '').replace(/\s+/g, ' ').trim() : '',
      bannerTitle: bar ? (bar.getAttribute('title') || '') : '',
      redCells: document.querySelectorAll('.dp-plan.short').length,
      dateCols: ths.filter((t) => /^\d{2}-\d{2}/.test(t)),
      rows,
    }
  })
}

await loginIfNeeded()
await restoreWindow()
console.log('lines=' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.wb-line-name')].map((e) => (e.textContent || '').trim()))))

const cases = [
  ['3号车间', 'round-02-board-3shop.png'],
  ['1号车间', 'round-03-board-1shop.png'],
  ['2号车间', 'round-04-board-2shop.png'],
]
for (const [line, shot] of cases) {
  const ok = await page.evaluate((k) => {
    const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith(k))
    if (!el) return 'not-found'
    el.click(); return 'ok'
  }, line)
  await page.waitForTimeout(4000)
  const r = await readBoard()
  console.log(`== ${line} clicked=${ok}`)
  console.log('  banner=' + JSON.stringify(r.banner))
  console.log('  bannerTitle=' + JSON.stringify(r.bannerTitle))
  console.log('  redCells=' + r.redCells + ' dateCols=' + JSON.stringify(r.dateCols))
  console.log('  rows=' + JSON.stringify(r.rows).slice(0, 3000))
  await page.screenshot({ path: SHOT + shot })
}

// 切英文:locale=键盘切换(Alt+L 轮换)太不稳;直接写 localStorage + reload
await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.goto(BASE + '/#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(4500)
await restoreWindow()
const okEn = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith('1号车间'))
  if (!el) return 'not-found'
  el.click(); return 'ok'
})
await page.waitForTimeout(3500)
const en = await readBoard()
console.log('== EN 1号车间 clicked=' + okEn)
console.log('  banner=' + JSON.stringify(en.banner))
console.log('  cellTitles=' + JSON.stringify(en.rows.flatMap((r) => r.cells.filter((c) => c.title).map((c) => c.title)).slice(0, 6)))
await page.screenshot({ path: SHOT + 'round-05-board-en.png' })
await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
console.log('DONE')
