const task = await taskSpace('finish-in-failqty')
const page = task.page('p1')
const box = await page.evaluate(() => {
  const th = [...document.querySelectorAll('.el-table__header th')].find((h) => (h.innerText || '').includes('不合格数量'))
  const body = document.querySelector('.el-table__body')
  const tr = body ? body.querySelector('tr') : null
  const idx = th ? [...th.parentElement.children].indexOf(th) : -1
  const cell = tr && idx >= 0 ? tr.children[idx] : null
  if (!cell) return null
  const r = cell.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }
})
console.log('cellBox: ' + JSON.stringify(box))
if (box) await page.mouse.click(box.x, box.y, { label: '不合格数量单元格' })
await page.waitForTimeout(1000)
const after = await page.evaluate(() => {
  const th = [...document.querySelectorAll('.el-table__header th')].find((h) => (h.innerText || '').includes('不合格数量'))
  const body = document.querySelector('.el-table__body')
  const tr = body ? body.querySelector('tr') : null
  const idx = th ? [...th.parentElement.children].indexOf(th) : -1
  const cell = tr && idx >= 0 ? tr.children[idx] : null
  return {
    cellHtml: cell ? cell.outerHTML.slice(0, 1200) : '',
    inputs: cell ? [...cell.querySelectorAll('input')].map((i) => ({ type: i.type, value: i.value, cls: i.className })) : [],
    active: document.activeElement ? document.activeElement.tagName + ':' + (document.activeElement.className || '') : '',
  }
})
console.log('after: ' + JSON.stringify(after, null, 1))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/finish-in-gate-qty/ego/round-07-failqty-click.png' })
console.log('shot ok')
