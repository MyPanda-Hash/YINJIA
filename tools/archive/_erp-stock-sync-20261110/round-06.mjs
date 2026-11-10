// round-06:选中第一行 → 找出工具栏动作元素(审核/转ERP…),并打印工具栏结构
const task = await taskSpace('stock-sync-kingdee-20261110')
const page = task.page('p1')

// 点第一行的第一个单元格(选中)
await page.evaluate(() => {
  const tr = document.querySelector('tbody tr')
  if (tr) {
    const cell = tr.querySelector('td')
    if (cell) cell.click()
    tr.click()
  }
})
await page.waitForTimeout(2000)

const info = await page.evaluate(() => {
  const els = [...document.querySelectorAll('*')].filter((el) => {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
    return (t === '审核' || t === '转ERP' || t === '弃审') && el.getBoundingClientRect().width > 0
  }).map((el) => ({
    tag: el.tagName, cls: String(el.className).slice(0, 60), t: (el.textContent || '').trim(),
    rect: [Math.round(el.getBoundingClientRect().x), Math.round(el.getBoundingClientRect().y),
      Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().height)],
  }))
  return { els: els.slice(0, 12) }
})
console.log(JSON.stringify(info, null, 1).slice(0, 1200))
