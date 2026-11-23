const task = await taskSpace(33)
const page = task.page('p1')
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
const OUT = '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-rd-fullpreview-20261120'
const PANELS = [
  ['RD_SAMPLE_EXT', '外部开发样品', 'button'],
  ['RD_SAMPLE_ND', '外部非开发样品', 'button'],
  ['RD_SAMPLE_INT', '内部开发样品', 'row'],
  ['RD_FILTER_EFF', '功能性滤效(数据记录表)', 'row'],
  ['RD_MOLD_PROC', '烧结工艺清单', 'row'],
  ['RD_PLAN', '项目实施计划', 'row'],
  ['RD_SPEC_DOC', '规格书', 'row'],
]
const results = []
const overlaySnap = () => {
  const panel = document.querySelector('.apv-panel')
  const rows = [...panel.querySelectorAll('.apv-table .el-table__body tr')]
  const cell = (tr, i) => tr ? (tr.querySelectorAll('td .cell')[i]?.textContent.trim() || '') : ''
  return {
    title: panel.querySelector('.apv-title')?.textContent.trim(),
    sub: panel.querySelector('.apv-sub')?.textContent.replace(/\s+/g, ' ').trim(),
    count: panel.querySelector('.apv-count')?.textContent.replace(/\s+/g, ' ').trim(),
    radios: [...panel.querySelectorAll('.apv-scope .el-radio-button')].map((el) => ({ label: el.textContent.trim(), on: el.classList.contains('is-active') })),
    selects: [...panel.querySelectorAll('.apv-sel')].length,
    gradeSelect: [...panel.querySelectorAll('.apv-sel .el-select__placeholder')].some((el) => el.textContent.trim() === '项目等级') || [...panel.querySelectorAll('.apv-sel input')].some((el) => el.placeholder === '项目等级'),
    hasDateRange: !!panel.querySelector('.apv-date'),
    hasReset: [...panel.querySelectorAll('.apv-bar .el-button')].some((b) => b.textContent.trim() === '重置'),
    headings: [...panel.querySelectorAll('.apv-table th .cell')].map((el) => el.textContent.trim()),
    rowCount: rows.length,
    firstCells: rows[0] ? [...rows[0].querySelectorAll('td .cell')].map((el) => el.textContent.trim()) : [],
    docNos: rows.map((tr) => cell(tr, 1)).filter(Boolean),
    empty: panel.querySelector('.apv-empty')?.textContent.replace(/\s+/g, ' ').trim() || '',
    sidePreviewShown: !!document.querySelector('.ps-wrap'),
    overflow: { sw: panel.scrollWidth, cw: panel.clientWidth },
  }
}
for (const [code, label, jumpMode] of PANELS) {
  const r = { code, label, jumpMode }
  try {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(350)
    await page.goto(`http://localhost:5173/#/panelx/list/${code}`)
    await page.waitForSelector('.as-side-btn', { timeout: 25000 })
    await page.waitForTimeout(800)
    r.clicked = await page.evaluate(() => {
      const lists = [...document.querySelectorAll('.panelx-list')].filter((x) => x.offsetParent !== null)
      const root = lists[0] || document
      const b = [...root.querySelectorAll('.as-side-btn')].find((x) => x.textContent.trim() === '单据预览')
      if (b) b.click()
      return !!b
    })
    await page.waitForFunction(() => document.querySelectorAll('.apv-panel').length === 1, undefined, { timeout: 10000 })
    r.default = await page.evaluate(overlaySnap)
    await page.screenshot({ path: `${OUT}/r05-${code}.png` })
    // 切「全部」
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('.apv-scope .el-radio-button')].find((x) => x.textContent.trim() === '全部')
      if (el) (el.querySelector('.el-radio-button__inner') || el).click()
    })
    await page.waitForTimeout(350)
    r.all = await page.evaluate(() => {
      const panel = document.querySelector('.apv-panel')
      const rows = [...panel.querySelectorAll('.apv-table .el-table__body tr')]
      return {
        count: panel.querySelector('.apv-count')?.textContent.replace(/\s+/g, ' ').trim(),
        rowCount: rows.length,
        docNos: rows.map((tr) => (tr.querySelectorAll('td .cell')[1]?.textContent.trim() || '')).filter(Boolean).slice(0, 3),
      }
    })
    const target = r.all.docNos[0]
    if (target) {
      await page.fill('.apv-search input', target)
      await page.waitForTimeout(350)
      r.keyword = await page.evaluate((t) => {
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
      await page.screenshot({ path: `${OUT}/r05-${code}-kw.png` })
      if (jumpMode === 'button') {
        r.jumpClicked = await page.evaluate(() => {
          const btn = [...document.querySelectorAll('.apv-table .el-button')].find((b) => b.textContent.trim() === '跳转')
          if (btn) btn.click()
          return !!btn
        })
      } else {
        r.jumpClicked = await page.evaluate(() => {
          const tr = document.querySelector('.apv-table .el-table__body tr')
          if (tr) (tr.querySelector('td') || tr).click()
          return !!tr
        })
      }
      await page.waitForFunction(() => !document.querySelector('.apv-panel'), undefined, { timeout: 10000 })
      await page.waitForTimeout(2200)
      r.afterJump = await page.evaluate((t) => {
        const lists = [...document.querySelectorAll('.panelx-list')].filter((x) => x.offsetParent !== null)
        const root = lists[0] || document.body
        const text = root.innerText.replace(/\s+/g, ' ')
        const pager = root.querySelector('.as-side-pager .page-no')?.textContent.trim() || ''
        return {
          url: location.href,
          overlayGone: !document.querySelector('.apv-panel'),
          pager,
          hasTarget: text.includes(t),
          targetInSheet: t,
        }
      }, target)
    } else {
      r.afterJump = { skipped: '该面板本地无数据（0 张）', empty: r.default.empty }
    }
  } catch (e) {
    r.error = String((e && e.message) || e)
  }
  results.push(r)
  console.log('---', code, JSON.stringify(r))
}
await import('node:fs/promises').then((fs) => fs.writeFile(`${OUT}/r05-evidence.json`, JSON.stringify(results, null, 1)))
console.log('DONE')
