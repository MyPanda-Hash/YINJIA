// round-22: 8090 页面状态诊断(为何没有纸面)
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await page.waitForTimeout(9000)
const st = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    url: location.href,
    sheet: !!document.querySelector('[data-ic-sheet]'),
    side: txt(document.querySelector('.approval-side')).slice(0, 120),
    listRows: document.querySelectorAll('.el-table__row').length,
    bodySnippet: txt(document.body).slice(0, 300),
  }
})
console.log(JSON.stringify(st, null, 2))
await page.screenshot({ path: dir + '/shots/round-22-8090-state.png' })
