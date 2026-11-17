import fsp from 'node:fs/promises'
const DIR = 'C:/Users/Lenovo/ego/gen-lines-select-all-20261118'
const task = await taskSpace('gen-lines-select-all-20261118')
const page = task.page('p1')

// 1) 左栏表头全选(本页)
await page.click('.dsr-grid thead th.dsr-check .el-checkbox', { label: '左栏全选本页' })
await page.waitForTimeout(800)
const picked = await page.evaluate(() => ({
  pickedText: (document.querySelector('.dsr-picked')?.textContent || '').replace(/\s+/g, ' ').trim(),
}))
console.log(JSON.stringify(picked))

// 2) 打开「生单 ▼」下拉
await page.click('.tb-group .tb-caret', { label: '展开生单下拉' })
await page.waitForTimeout(900)

const menu = await page.evaluate(() => {
  const items = [...document.querySelectorAll('body *')]
    .filter((el) => {
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim()
      return own && /批量生单|合单生单/.test(own) && el.offsetParent !== null
    })
    .map((el) => ({ tag: el.tagName, cls: String(el.className).slice(0, 80), text: el.textContent.trim().slice(0, 40) }))
  return items
})
console.log(JSON.stringify(menu, null, 2))
await page.screenshot({ path: DIR + '/round-06-menu.png' })
