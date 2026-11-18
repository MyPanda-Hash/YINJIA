const task = await taskSpace('finish-in-failqty')
const page = task.page('p1')
const r1 = await page.evaluate(() => {
  const bodyWrap = document.querySelector('.el-table__body-wrapper')
  const sc = (bodyWrap && (bodyWrap.querySelector('.el-scrollbar__wrap') || bodyWrap)) || null
  const headerWrap = document.querySelector('.el-table__header-wrapper')
  if (sc) {
    sc.scrollLeft = 1250
    sc.dispatchEvent(new Event('scroll', { bubbles: true }))
  }
  if (headerWrap) headerWrap.scrollLeft = 1250
  return { bodyCls: bodyWrap?.className, scCls: sc?.className, scLeft: sc?.scrollLeft, scMax: sc ? sc.scrollWidth - sc.clientWidth : -1 }
})
console.log('scroll: ' + JSON.stringify(r1))
await page.waitForTimeout(800)
const before = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.el-table__header th')]
  const th = heads.find((h) => (h.innerText || '').includes('不合格数量'))
  const out = { thBox: null }
  if (th) { const r = th.getBoundingClientRect(); out.thBox = { left: r.left, top: r.top, w: r.width } }
  const td = th ? th.closest('table')?.closest('.el-table__header-wrapper') : null
  const body = document.querySelector('.el-table__body')
  const tr = body ? body.querySelector('tr') : null
  if (th && tr) {
    const idx = [...th.parentElement.children].indexOf(th)
    const cell = tr.children[idx]
    out.idx = idx
    out.cellHtml = cell ? cell.outerHTML.slice(0, 900) : '(none)'
    if (cell) { cell.click(); out.clicked = true }
  }
  return out
})
console.log('before: ' + JSON.stringify(before))
await page.waitForTimeout(900)
const after = await page.evaluate(() => {
  const body = document.querySelector('.el-table__body')
  const tr = body ? body.querySelector('tr') : null
  const th = [...document.querySelectorAll('.el-table__header th')].find((h) => (h.innerText || '').includes('不合格数量'))
  const out = { inputs: [], cellHtml: '' }
  if (tr && th) {
    const idx = [...th.parentElement.children].indexOf(th)
    const cell = tr.children[idx]
    out.cellHtml = cell ? cell.outerHTML.slice(0, 900) : ''
    out.inputs = cell ? [...cell.querySelectorAll('input')].map((i) => ({ type: i.type, value: i.value, ph: i.placeholder })) : []
  }
  return out
})
console.log('after: ' + JSON.stringify(after))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/finish-in-gate-qty/ego/round-06-failqty-cell.png' })
console.log('shot ok')
