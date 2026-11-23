// round-26: 最终打包版复核(8090, 新入口 chunk index-CM4oSmjy.js)
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
const out = {}
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_BHC', { timeout: 60000 })
await page.waitForTimeout(7000)
await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((n) => (n.innerText || '').includes('BHC-2026-09-0001'))
  if (tr) tr.click()
})
await page.waitForTimeout(2500)
out.bhc = await page.evaluate(() => ({
  titleH: Math.round(document.querySelector('.as-title')?.getBoundingClientRect().height || 0),
  time: [...document.querySelectorAll('.as-info-row')].map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim()).slice(-1)[0],
  railHeaders: [...document.querySelectorAll('th, .drp-th')].map((x) => (x.innerText || '').trim()).filter((x) => ['单号', '日期', '客户名称', '产品编码', '审核状态'].includes(x)),
  signInputs: [...document.querySelectorAll('.q-sign-input input')].map((i) => i.value),
  chunk: [...document.querySelectorAll('script')].map((s) => s.src).find((x) => x.includes('index-')),
}))
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_PROC_INSP_DETAIL', { timeout: 60000 })
await page.waitForTimeout(8000)
out.detail = await page.evaluate(() => ({
  chunk: [...document.querySelectorAll('script')].map((s) => s.src).find((x) => x.includes('index-')),
  rows: document.querySelectorAll('.el-table__body tr').length,
  total: (document.querySelector('.el-table, .panelx-list')?.innerText || '').match(/共\s*(\d+)\s*条/)?.[1] || '',
}))
await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderProgress', { timeout: 60000 })
await page.waitForTimeout(9000)
out.board = await page.evaluate(() => ({
  selects: [...document.querySelectorAll('.wpb-controls .el-select')].map((s) => (s.innerText || '').replace(/\s+/g, ' ').trim()),
  stats: (document.querySelector('.wpb-stats')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 70),
}))
console.log(JSON.stringify(out, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-26-final-board.png' })
