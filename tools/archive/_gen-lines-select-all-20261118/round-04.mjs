const task = await taskSpace('gen-lines-select-all-20261118')
const page = task.page('p1')

const info = await page.evaluate(() => {
  const main = [...document.querySelectorAll('.tb-main')].map((e) => e.outerHTML.slice(0, 400))
  const group = [...document.querySelectorAll('.tb-main')][0]?.parentElement
  return {
    mains: main,
    groupCls: group?.className || '',
    groupHtml: (group?.outerHTML || '').slice(0, 1600),
  }
})
console.log(JSON.stringify(info, null, 2))
