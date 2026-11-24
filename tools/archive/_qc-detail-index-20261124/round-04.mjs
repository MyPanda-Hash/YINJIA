// round-04 — 点待检验目录第 1 行「↗ 跳转到该检验单」,看落到哪里/是否空表
const OUT = 'D:/YINJIA-main/_scratch/qc-link-20261124'
const task = await taskSpace('qc rec detail index link prod')
const page = task.page('p1')
console.log('start url: ' + await page.url())
const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.cs-link')].find((e) => (e.getAttribute('title') || '').includes('跳转到该检验单'))
  if (!el) return 'NO-LINK'
  el.click()
  return (el.parentElement.innerText || '').trim()
})
console.log('clicked row/no: ' + clicked)
await page.waitForTimeout(6000)
const after = await page.evaluate(() => {
  const tbls = [...document.querySelectorAll('table')]
  const bodyTbl = tbls.find((t) => t.querySelectorAll('tbody tr').length > 0)
  const rows = bodyTbl ? [...bodyTbl.querySelectorAll('tbody tr')].slice(0, 3).map((tr) => tr.innerText.replace(/\s+/g, ' ').trim().slice(0, 160)) : []
  return {
    url: location.href,
    tabTitles: [...document.querySelectorAll('.el-tabs__item, .tab-item, [class*="tab"]')].map((e) => (e.innerText || '').trim()).filter(Boolean).slice(0, 12),
    totalText: (document.body.innerText.match(/共\s*\d+\s*条/g) || []).join(' , '),
    rows,
    msg: [...document.querySelectorAll('.el-message')].map((e) => e.innerText).join(' | '),
    body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 600),
  }
})
console.log(JSON.stringify(after, null, 2))
await page.screenshot({ path: OUT + '/round-04-jump-insp.png' })
