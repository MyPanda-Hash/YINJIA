// round-02 — 明细表的单号单元格是否有可点索引(📄/↗),并抓行数据
const OUT = 'D:/YINJIA-main/_scratch/qc-link-20261124'
const task = await taskSpace('qc rec detail index link prod')
const page = task.page('p1')
console.log('url: ' + await page.url())
const data = await page.evaluate(() => {
  // 表头列序
  const headTbl = [...document.querySelectorAll('table')][0]
  const heads = [...headTbl.querySelectorAll('thead th')].map((th) => th.innerText.replace(/[\s⇅]+/g, ' ').trim())
  const bodyTbl = [...document.querySelectorAll('table')][1]
  const rows = [...bodyTbl.querySelectorAll('tbody tr')].slice(0, 5).map((tr) => {
    const tds = [...tr.querySelectorAll('td')]
    return tds.map((td) => ({
      text: td.innerText.replace(/\s+/g, ' ').trim().slice(0, 40),
      cls: td.className,
      links: [...td.querySelectorAll('.cs-link, .cs-no-cell, [class*="link"], a, button, i, span[title]')].map((e) => ({
        tag: e.tagName,
        cls: e.className,
        title: e.getAttribute('title'),
        text: (e.innerText || '').trim().slice(0, 10),
      })),
      html: td.innerHTML.slice(0, 220),
    }))
  })
  // 行操作按钮
  const opCells = [...bodyTbl.querySelectorAll('tbody tr')].slice(0, 3).map((tr) => {
    const tds = [...tr.querySelectorAll('td')]
    return tds.slice(-2).map((td) => td.innerHTML.replace(/\s+/g, ' ').slice(0, 300))
  })
  return { heads, rows, opCells, bodyText: document.body.innerText.length }
})
console.log(JSON.stringify(data, null, 2))
