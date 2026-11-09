const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
const st = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('table tbody tr')].slice(0, 3)
  return rows.map((tr) => [...tr.querySelectorAll('td')].map((td) => {
    const ta = td.querySelector('textarea')
    const sp = td.querySelector('.sg-ro')
    return ta ? ('IN:' + (ta.value || '').slice(0, 8)) : (sp ? ('RO:' + (sp.textContent || '').slice(0, 8)) : 'EMPTY')
  }))
})
console.log('前三行每格渲染 =', JSON.stringify(st, null, 1))
const pager = await page.evaluate(() => (document.querySelector('.sg-pager') || {}).textContent || '')
console.log('分页条 =', String(pager).replace(/\s+/g, ' ').trim())
