const task = await taskSpace(33)
const page = task.page('p1')
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
const OUT = '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-rd-fullpreview-20261120'
const PANELS = [
  ['RD_SAMPLE_EXT', '外部开发样品'],
  ['RD_SAMPLE_ND', '外部非开发样品'],
  ['RD_SAMPLE_INT', '内部开发样品'],
  ['RD_FILTER_EFF', '功能性滤效(数据记录表)'],
  ['RD_MOLD_PROC', '烧结工艺清单'],
  ['RD_PLAN', '项目实施计划'],
  ['RD_SPEC_DOC', '规格书'],
]
const results = []
for (const [code, label] of PANELS) {
  const r = { code, label, steps: {} }
  try {
    await page.goto(`http://localhost:5173/#/panelx/list/${code}`)
    await page.waitForSelector('.as-side-btn', { timeout: 25000 })
    await page.waitForTimeout(900)
    r.steps.clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll('.as-side-btn')].find((x) => x.textContent.trim() === '单据预览')
      if (b) b.click()
      return !!b
    })
    await page.waitForSelector('.apv-panel', { timeout: 10000 })
    r.steps.opened = await page.evaluate(() => {
      const panel = document.querySelector('.apv-panel')
      const rows = [...panel.querySelectorAll('.apv-table .el-table__body tr')]
      return {
        title: panel.querySelector('.apv-title')?.textContent.trim(),
        sub: panel.querySelector('.apv-sub')?.textContent.replace(/\s+/g, ' ').trim(),
        count: panel.querySelector('.apv-count')?.textContent.replace(/\s+/g, ' ').trim(),
        radios: [...panel.querySelectorAll('.apv-scope .el-radio-button')].map((el) => ({ label: el.textContent.trim(), on: el.classList.contains('is-active') })),
        selects: [...panel.querySelectorAll('.apv-sel')].map((el) => el.querySelector('input')?.closest('.el-select')?.querySelector('.el-select__placeholder, .el-select__selected-item')?.textContent.trim() || el.querySelector('input')?.placeholder || ''),
        gradeSelect: [...panel.querySelectorAll('.apv-sel')].some((el, i) => i === 1),
        hasDateRange: !!panel.querySelector('.apv-date'),
        headings: [...panel.querySelectorAll('.apv-table th .cell')].map((el) => el.textContent.trim()),
        rowCount: rows.length,
        firstCells: rows[0] ? [...rows[0].querySelectorAll('td .cell')].map((el) => el.textContent.trim()) : [],
        sidePreviewShown: !!document.querySelector('.ps-wrap'),
        empty: panel.querySelector('.apv-empty')?.textContent.replace(/\s+/g, ' ').trim() || '',
        overflow: { sw: panel.scrollWidth, cw: panel.clientWidth },
      }
    })
    await page.screenshot({ path: `${OUT}/r03-${code}.png` })
    // 切「全部」
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('.apv-scope .el-radio-button')].find((x) => x.textContent.trim() === '全部')
      if (el) (el.querySelector('.el-radio-button__inner') || el).click()
    })
    await page.waitForTimeout(400)
    r.steps.all = await page.evaluate(() => {
      const panel = document.querySelector('.apv-panel')
      const rows = [...panel.querySelectorAll('.apv-table .el-table__body tr')]
      const cell = (tr, i) => tr ? (tr.querySelectorAll('td .cell')[i]?.textContent.trim() || '') : ''
      const nos = rows.map((tr) => cell(tr, 1)).filter(Boolean)
      return { count: panel.querySelector('.apv-count')?.textContent.replace(/\s+/g, ' ').trim(), rowCount: rows.length, docNos: nos.slice(0, 3) }
    })
    if (r.steps.all.docNos.length) {
      const target = r.steps.all.docNos[0]
      // 关键字筛选：按第一张单号收窄（整行字段匹配）
      await page.fill('.apv-search input', target)
      await page.waitForTimeout(350)
      r.steps.keyword = await page.evaluate((t) => {
        const panel = document.querySelector('.apv-panel')
        const rows = [...panel.querySelectorAll('.apv-table .el-table__body tr')]
        const texts = rows.map((tr) => tr.textContent.replace(/\s+/g, ' ').trim())
        return {
          keyword: t,
          count: panel.querySelector('.apv-count')?.textContent.replace(/\s+/g, ' ').trim(),
          rowCount: rows.length,
          allMatch: texts.every((x) => x.includes(t)),
        }
      }, target)
      await page.screenshot({ path: `${OUT}/r03-${code}-kw.png` })
      // 点行跳转
      r.steps.jump = await page.evaluate(() => {
        const tr = document.querySelector('.apv-table .el-table__body tr')
        if (tr) (tr.querySelector('td') || tr).click()
        return !!tr
      })
      await page.waitForFunction(() => !document.querySelector('.apv-panel'), undefined, { timeout: 10000 })
      await page.waitForTimeout(1600)
      r.steps.afterJump = { url: await page.url(), chip: await page.evaluate(() => document.querySelector('.doc-chip')?.textContent.replace(/\s+/g, ' ').trim() || ''), want: target }
    }
  } catch (e) {
    r.error = String(e && e.message || e)
  }
  results.push(r)
  console.log('---', code, JSON.stringify(r))
}
await import('node:fs/promises').then((fs) => fs.writeFile(`${OUT}/r03-evidence.json`, JSON.stringify(results, null, 1)))
console.log('DONE')
