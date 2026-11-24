// round-21 — 冷启动慢,轮询等到表格出数再判定链接
const OUT = 'D:/YINJIA-main/_scratch/qc-link-20261124'
const BASE = 'http://localhost:5173'
const task = await taskSpace('qc detail index verify after rebase')
const page = task.page('p1')
console.log('start url: ' + await page.url())
if (!(await page.url()).includes('5173')) {
  await page.goto(BASE + '/#/dashboard', { timeout: 180000 })
  await page.waitForTimeout(4000)
}
await page.goto(BASE + '/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 180000 })
let rows = 0
let links = 0
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(1500)
  const st = await page.evaluate(() => {
    const t = [...document.querySelectorAll('table')].find((x) => x.querySelectorAll('tbody tr').length > 0)
    return {
      rows: t ? t.querySelectorAll('tbody tr').length : 0,
      links: document.querySelectorAll('.doc-no-link').length,
      loading: !!document.querySelector('.el-loading-mask'),
      body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160),
    }
  })
  rows = st.rows
  links = st.links
  if (i % 4 === 0) console.log(`t=${(i + 1) * 1.5}s rows=${st.rows} links=${st.links} loading=${st.loading} | ${st.body.slice(0, 80)}`)
  if (st.rows > 0 && st.links > 0) break
}
const dump = await page.evaluate(() => ({
  url: location.href,
  rows: (() => { const t = [...document.querySelectorAll('table')].find((x) => x.querySelectorAll('tbody tr').length > 0); return t ? t.querySelectorAll('tbody tr').length : 0 })(),
  links: [...document.querySelectorAll('.doc-no-link')].slice(0, 6).map((e) => e.innerText.trim()),
  count: document.querySelectorAll('.doc-no-link').length,
}))
console.log('FINAL ' + JSON.stringify(dump))
await page.screenshot({ path: OUT + '/round-21-detail.png' })
