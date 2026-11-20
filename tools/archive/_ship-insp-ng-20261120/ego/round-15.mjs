const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
const state = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const act = document.querySelector('.qr-head-table')
  return {
    hash: location.hash,
    title: document.title,
    activeRow: txt(document.querySelector('.doc-list tr.on, .rail-row.on, .ds-row.on, [class*="row"].on')),
    head: act ? txt(act) : '',
    gridRows: document.querySelectorAll('.qr-grid tbody tr').length,
    band: txt(document.querySelector('.qr-band')),
    foot: txt(document.querySelector('.qr-foot-table')),
    titles: [...document.querySelectorAll('.qr-title, .as-title, .panel-title')].map((e) => txt(e)).slice(0, 5),
  }
})
console.log(JSON.stringify(state, null, 2))
