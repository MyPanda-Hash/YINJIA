// round-34:重载采购订单页,确认数据/工具栏已出(上次可能是后端刚起来时打开导致空白)
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.reload({ timeout: 40000 })
await page.waitForTimeout(8000)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const errBox = document.querySelector('#boot-fatal')
  return {
    hash: location.hash,
    title: document.title,
    panelTitle: txt(document.querySelector('.panel-name, .px-title, .doc-head-name')).slice(0, 60),
    rows: [...document.querySelectorAll('tbody tr')].length,
    firstRows: [...document.querySelectorAll('tbody tr')].slice(0, 2).map(txt),
    toolbar: [...document.querySelectorAll('.tb-group')].map(txt),
    fatal: errBox ? txt(errBox).slice(0, 200) : '',
    bootTip: !!document.getElementById('boot-tip'),
    bodyHead: txt(document.body).slice(0, 160),
  }
})
console.log('afterReload=' + JSON.stringify(info, null, 2))
try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-34-system.png' })
  console.log('shot=' + p)
} catch (e) {
  console.log('shot fail: ' + e.message)
}
