// round-12:选 5 行那单据 + 摸「打印」按钮的容器结构(找下拉箭头)
const task = await taskSpace('saleout-shipnote-20261128')
const page = task.page('p1')
const log = (...a) => console.log(...a)

// 点行
const picked = await page.evaluate(() => {
  const trs = [...document.querySelectorAll('tr')]
  const tr = trs.find((el) => (el.textContent || '').includes('XSCK-20261126-00009'))
  if (!tr) return null
  tr.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)
})
log('选中行=', picked)
await page.waitForTimeout(3500)

const info = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const printBtn = [...document.querySelectorAll('button')].find((b) => t(b) === '打印')
  const group = printBtn?.parentElement
  const detailTable = [...document.querySelectorAll('table')].find((tb) => /存货|数量/.test(t(tb)) && tb.querySelectorAll('tbody tr').length > 0)
  return {
    curDoc: (document.body.textContent.match(/单据：(XSCK-\S+?)(?=已审核|草稿)/) || [])[1] || '',
    printBtnOuter: printBtn ? printBtn.outerHTML.slice(0, 200) : null,
    groupOuter: group ? group.outerHTML.slice(0, 700) : null,
    detailRows: detailTable ? [...detailTable.querySelectorAll('tbody tr')].map(t).slice(0, 8) : [],
  }
})
log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-12-selected.png' })
