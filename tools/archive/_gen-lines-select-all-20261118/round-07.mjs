import fsp from 'node:fs/promises'
const DIR = 'C:/Users/Lenovo/ego/gen-lines-select-all-20261118'
const task = await taskSpace('gen-lines-select-all-20261118')
const page = task.page('p1')

const clicked = await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tb-group')].find((x) => (x.textContent || '').trim().startsWith('生单'))
  const caret = g?.querySelector('.tb-caret')
  if (!caret) return 'no-caret'
  caret.click()
  return 'ok:' + (g.textContent || '').trim().slice(0, 40)
})
console.log(clicked)
await page.waitForTimeout(1000)

const menu = await page.evaluate(() => [...document.querySelectorAll('body *')]
  .filter((el) => {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim()
    return own && /批量生单|合单生单/.test(own) && el.offsetParent !== null
  })
  .map((el) => ({ tag: el.tagName, cls: String(el.className).slice(0, 90), text: (el.textContent || '').trim().slice(0, 40) })))
console.log(JSON.stringify(menu, null, 2))
await page.screenshot({ path: DIR + '/round-07-menu.png' })
