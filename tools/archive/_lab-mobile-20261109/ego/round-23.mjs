const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
const html = await page.evaluate(() => {
  const side = document.querySelector('.approval-side, .side, [class*=side]')
  const scope = side || document.body
  const cands = [...scope.querySelectorAll('*')]
    .filter((e) => !e.children.length && /查找|模糊搜索|添加条件/.test(e.textContent || ''))
    .map((e) => ({ tag: e.tagName, cls: e.className, txt: (e.textContent || '').trim(), parentCls: e.parentElement?.className }))
  return cands
})
console.log(JSON.stringify(html, null, 2))
