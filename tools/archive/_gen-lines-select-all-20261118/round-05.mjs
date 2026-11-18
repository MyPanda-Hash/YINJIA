const task = await taskSpace('gen-lines-select-all-20261118')
const page = task.page('p1')

const info = await page.evaluate(() => {
  const gs = [...document.querySelectorAll('.tb-group')]
  const g = gs.find((x) => /生单/.test(x.textContent || ''))
  return { count: gs.length, html: (g?.outerHTML || '').slice(0, 2500) }
})
console.log(JSON.stringify(info, null, 2))
