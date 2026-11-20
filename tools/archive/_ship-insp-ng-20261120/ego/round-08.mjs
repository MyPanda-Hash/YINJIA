const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
const dump = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  return {
    selects: [...document.querySelectorAll('.el-select')].map((s) => ({ cls: (s.className || '').toString().slice(0, 60), text: txt(s) })),
    inputs: [...document.querySelectorAll('input')].map((i) => ({ ph: i.placeholder, type: i.type })),
    labels: [...document.querySelectorAll('label,.lg-label,.login-label')].map((l) => txt(l)).slice(0, 10),
  }
})
console.log(JSON.stringify(dump, null, 2))
