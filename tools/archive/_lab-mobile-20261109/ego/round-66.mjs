const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
const st = await page.evaluate(() => ({
  hash: location.hash,
  factory: JSON.parse(localStorage.getItem('mes_factory') || 'null'),
  title: document.querySelector('.labm-title')?.textContent?.trim() || '',
  err: document.querySelector('.labm-err')?.textContent?.trim() || '',
  lines: [...document.querySelectorAll('.labm-line')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  empty: document.querySelector('.labm-empty')?.textContent?.trim() || '',
  rowCount: document.querySelectorAll('.labm-drow').length,
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
}))
console.log(JSON.stringify(st, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-66-state.png' })
