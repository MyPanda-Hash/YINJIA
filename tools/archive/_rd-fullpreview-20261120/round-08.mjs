const task = await taskSpace(33)
const page = task.page('p1')
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
const OUT = '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-rd-fullpreview-20261120'
const PANELS = ['RD_SAMPLE_EXT', 'RD_SAMPLE_ND', 'RD_SAMPLE_INT', 'RD_FILTER_EFF', 'RD_MOLD_PROC', 'RD_PLAN', 'RD_SPEC_DOC']
const out = []
for (const code of PANELS) {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  await page.goto(`http://localhost:5173/#/panelx/list/${code}`)
  await page.waitForSelector('.as-side-btn', { timeout: 25000 })
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const root = [...document.querySelectorAll('.panelx-list')].filter((x) => x.offsetParent !== null)[0] || document
    const b = [...root.querySelectorAll('.as-side-btn')].find((x) => x.textContent.trim() === '单据预览')
    if (b) b.click()
  })
  await page.waitForFunction(() => document.querySelectorAll('.apv-panel').length === 1, undefined, { timeout: 10000 })
  const snap = await page.evaluate(() => {
    const panel = document.querySelector('.apv-panel')
    const rows = [...panel.querySelectorAll('.apv-table .el-table__body tr')]
    return {
      title: panel.querySelector('.apv-title')?.textContent.trim(),
      sub: panel.querySelector('.apv-sub')?.textContent.replace(/\s+/g, ' ').trim(),
      count: panel.querySelector('.apv-count')?.textContent.replace(/\s+/g, ' ').trim(),
      scopeOn: [...panel.querySelectorAll('.apv-scope .el-radio-button')].find((x) => x.classList.contains('is-active'))?.textContent.trim(),
      gradeShown: [...panel.querySelectorAll('.apv-sel')].some((el) => (el.querySelector('input')?.placeholder || '') === '项目等级'),
      headings: [...panel.querySelectorAll('.apv-table th .cell')].map((el) => el.textContent.trim()),
      rowCount: rows.length,
      overflow: { sw: panel.scrollWidth, cw: panel.clientWidth },
    }
  })
  out.push({ code, ...snap })
  await page.screenshot({ path: `${OUT}/r08-${code}.png` })
  console.log(code, JSON.stringify(snap))
}
// 关键字筛选取证（立项目标：能筛选）
await page.keyboard.press('Escape')
await page.waitForTimeout(250)
await page.goto('http://localhost:5173/#/panelx/list/RD_MOLD_PROC')
await page.waitForSelector('.as-side-btn', { timeout: 25000 })
await page.waitForTimeout(500)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((x) => x.textContent.trim() === '单据预览')
  if (b) b.click()
})
await page.waitForFunction(() => document.querySelectorAll('.apv-panel').length === 1, undefined, { timeout: 10000 })
await page.fill('.apv-search input', 'MP-2026-11-0004')
await page.waitForTimeout(400)
const kw = await page.evaluate(() => {
  const panel = document.querySelector('.apv-panel')
  const rows = [...panel.querySelectorAll('.apv-table .el-table__body tr')]
  return { count: panel.querySelector('.apv-count')?.textContent.replace(/\s+/g, ' ').trim(), rows: rows.length, text: rows.map((tr) => tr.textContent.replace(/\s+/g, ' ').trim()) }
})
console.log('keyword:', JSON.stringify(kw))
await page.screenshot({ path: `${OUT}/r08-RD_MOLD_PROC-keyword.png` })
await import('node:fs/promises').then((fs) => fs.writeFile(`${OUT}/r08-evidence.json`, JSON.stringify({ panels: out, keyword: kw }, null, 1)))
// 768 窄屏浮层检查
await page.keyboard.press('Escape')
await page.waitForTimeout(250)
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 768, height: 800, deviceScaleFactor: 1, mobile: false })
await page.goto('http://localhost:5173/#/panelx/list/RD_PLAN')
await page.waitForSelector('.as-side-btn', { timeout: 25000 })
await page.waitForTimeout(600)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((x) => x.textContent.trim() === '单据预览')
  if (b) b.click()
})
await page.waitForFunction(() => document.querySelectorAll('.apv-panel').length === 1, undefined, { timeout: 10000 })
const narrow = await page.evaluate(() => {
  const panel = document.querySelector('.apv-panel')
  const bar = panel.querySelector('.apv-bar')
  const tableWrap = panel.querySelector('.apv-table-wrap')
  return {
    vw: innerWidth,
    panel: { sw: panel.scrollWidth, cw: panel.clientWidth, sh: panel.scrollHeight, ch: panel.clientHeight },
    bar: { sw: bar.scrollWidth, cw: bar.clientWidth, h: bar.getBoundingClientRect().height },
    tableWrap: tableWrap ? { sw: tableWrap.scrollWidth, cw: tableWrap.clientWidth } : null,
    pageScroll: { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth },
  }
})
console.log('narrow-768:', JSON.stringify(narrow))
await page.screenshot({ path: `${OUT}/r08-RD_PLAN-768.png` })
console.log('DONE')
