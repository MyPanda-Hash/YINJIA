const task = await taskSpace(33)
const page = task.page('p1')
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
const OUT = '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-rd-fullpreview-20261120'
const CASES = [
  ['RD_SAMPLE_EXT', 2],
  ['RD_SAMPLE_INT', 2],
  ['RD_FILTER_EFF', 4],
  ['RD_MOLD_PROC', 2],
  ['RD_PLAN', 2],
  ['RD_SPEC_DOC', 2],
]
const out = []
for (const [code, pick] of CASES) {
  const r = { code, pick }
  try {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await page.goto(`http://localhost:5173/#/panelx/list/${code}`)
    await page.waitForSelector('.as-side-btn', { timeout: 25000 })
    await page.waitForTimeout(700)
    await page.evaluate(() => {
      const lists = [...document.querySelectorAll('.panelx-list')].filter((x) => x.offsetParent !== null)
      const root = lists[0] || document
      const b = [...root.querySelectorAll('.as-side-btn')].find((x) => x.textContent.trim() === '单据预览')
      if (b) b.click()
    })
    await page.waitForFunction(() => document.querySelectorAll('.apv-panel').length === 1, undefined, { timeout: 10000 })
    // 默认范围（应当：有这个人的单 ⇒ 我的；否则全部）
    r.default = await page.evaluate(() => {
      const panel = document.querySelector('.apv-panel')
      return {
        count: panel.querySelector('.apv-count')?.textContent.replace(/\s+/g, ' ').trim(),
        scopeOn: [...panel.querySelectorAll('.apv-scope .el-radio-button')].find((x) => x.classList.contains('is-active'))?.textContent.trim(),
      }
    })
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('.apv-scope .el-radio-button')].find((x) => x.textContent.trim() === '全部')
      if (el) (el.querySelector('.el-radio-button__inner') || el).click()
    })
    await page.waitForTimeout(300)
    const all = await page.evaluate(() => {
      const panel = document.querySelector('.apv-panel')
      const rows = [...panel.querySelectorAll('.apv-table .el-table__body tr')]
      return rows.map((tr) => (tr.querySelectorAll('td .cell')[1]?.textContent.trim() || '')).filter(Boolean)
    })
    r.allDocNos = all
    const target = all[Math.min(pick, all.length - 1)]
    r.target = target
    await page.fill('.apv-search input', target)
    await page.waitForTimeout(300)
    r.filtered = await page.evaluate(() => {
      const panel = document.querySelector('.apv-panel')
      const rows = [...panel.querySelectorAll('.apv-table .el-table__body tr')]
      return { count: panel.querySelector('.apv-count')?.textContent.replace(/\s+/g, ' ').trim(), rowCount: rows.length }
    })
    // 点行（不是第一行也能点，因为已筛到唯一一张）
    await page.evaluate(() => {
      const tr = document.querySelector('.apv-table .el-table__body tr')
      if (tr) (tr.querySelector('td') || tr).click()
    })
    await page.waitForFunction(() => !document.querySelector('.apv-panel'), undefined, { timeout: 10000 })
    await page.waitForTimeout(2300)
    r.after = await page.evaluate((t) => {
      const root = [...document.querySelectorAll('.panelx-list')].filter((x) => x.offsetParent !== null)[0] || document.body
      const text = root.innerText.replace(/\s+/g, ' ')
      const pager = root.querySelector('.as-side-pager .page-no')?.textContent.trim() || ''
      return {
        pager,
        hasTarget: text.includes(t),
        snippet: text.slice(0, 260),
      }
    }, target)
    await page.screenshot({ path: `${OUT}/r06-${code}-after.png` })
  } catch (e) {
    r.error = String((e && e.message) || e)
  }
  out.push(r)
  console.log('---', code, JSON.stringify(r))
}
await import('node:fs/promises').then((fs) => fs.writeFile(`${OUT}/r06-evidence.json`, JSON.stringify(out, null, 1)))
console.log('DONE')
