// round-10 — 本地 5173:登录 + 打开检验数据记录明细表,确认两个单号列变成可点索引
const OUT = 'D:/YINJIA-main/_scratch/qc-link-20261124'
const BASE = 'http://localhost:5173'
const task = await taskSpace('qc rec detail index link prod')
const page = task.page('p1')
await page.goto(BASE + '/#/login', { timeout: 120000 })
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch (e) {} })
await page.reload({ timeout: 120000 })
await page.waitForTimeout(2500)
await page.fill('.login-form input[autocomplete="username"]', 'admin')
await page.fill('.login-form input[type="password"]', '123456')
const sel = await page.evaluate(() => {
  const el = document.querySelector('.login-form .el-select')
  return el ? el.innerText.replace(/\s+/g, ' ').trim() : ''
})
if (!sel || sel.includes('请选择')) {
  await page.click('.login-form .el-select')
  await page.waitForTimeout(500)
  await page.click('.el-select-dropdown__item')
  await page.waitForTimeout(300)
}
await page.click('.login-submit')
await page.waitForTimeout(5000)
console.log('after login: ' + await page.url())
await page.goto(BASE + '/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 120000 })
await page.waitForTimeout(7000)
const info = await page.evaluate(() => {
  const headTbl = [...document.querySelectorAll('table')][0]
  const heads = [...headTbl.querySelectorAll('thead th')].map((th) => th.innerText.replace(/[\s⇅]+/g, ' ').trim())
  const bodyTbl = [...document.querySelectorAll('table')].find((t) => t.querySelectorAll('tbody tr').length > 0)
  const rows = [...bodyTbl.querySelectorAll('tbody tr')].slice(0, 4).map((tr) => {
    const tds = [...tr.querySelectorAll('td')]
    const i6 = heads.indexOf('检验数据记录单号')
    const i7 = heads.indexOf('来料检验单号')
    return {
      rec: tds[5] ? tds[5].innerText.trim() : '',
      insp: tds[6] ? tds[6].innerText.trim() : '',
      recHtml: tds[5] ? tds[5].innerHTML.replace(/\s+/g, ' ').slice(0, 200) : '',
      inspHtml: tds[6] ? tds[6].innerHTML.replace(/\s+/g, ' ').slice(0, 200) : '',
      links: [...tr.querySelectorAll('.doc-no-link')].map((e) => ({ text: e.innerText.trim(), title: e.getAttribute('title') })),
      idx: { i6, i7 },
    }
  })
  return { url: location.href, heads, rows, totalLinks: document.querySelectorAll('.doc-no-link').length }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: OUT + '/round-10-detail-links.png' })
