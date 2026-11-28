// round-13:摸清「打印」这一组的 DOM(act-name 的祖先 + 下拉箭头),然后打开下拉读菜单
const task = await taskSpace('saleout-shipnote-20261128')
const page = task.page('p1')
const log = (...a) => console.log(...a)

const dom = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const nameSpan = [...document.querySelectorAll('span.act-name')].find((el) => t(el) === '打印')
  const chain = []
  let el = nameSpan
  for (let i = 0; i < 5 && el; i++) { chain.push({ tag: el.tagName, cls: el.className }); el = el.parentElement }
  const group = nameSpan?.closest('[class]')?.parentElement
  return {
    chain,
    groupOuter: group ? group.outerHTML.slice(0, 900) : null,
  }
})
log(JSON.stringify(dom, null, 2))
