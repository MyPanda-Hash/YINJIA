import fsp from 'node:fs/promises'
const DIR = 'C:/Users/Lenovo/ego/gen-lines-select-all-20261118'
const task = await taskSpace('gen-lines-select-all-20261118')
const page = task.page('p1')

const read = () => page.evaluate(() => {
  const pickAll = document.querySelector('.gl-pick-all')
  const cb = pickAll?.querySelector('.el-checkbox')
  return {
    bar: (pickAll?.textContent || '').replace(/\s+/g, ' ').trim(),
    indeterminate: !!cb?.classList.contains('is-indeterminate'),
    checked: !!cb?.classList.contains('is-checked'),
    disabled: cb?.classList.contains('is-disabled'),
    perDoc: [...document.querySelectorAll('.gl-doc-pick .gl-picked')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
    footer: (document.querySelector('.gl-foot')?.textContent || '').replace(/\s+/g, ' ').trim(),
    qtys: [...document.querySelectorAll('.gl-doc .el-table__body .el-input-number input')].map((i) => i.value),
    greys: [...document.querySelectorAll('.gl-doc .el-table__body tr')].map((tr) => tr.className).slice(0, 4),
  }
})

console.log('BEFORE', JSON.stringify(await read()))

// 点顶部「全选」
await page.click('.gl-pick-all .el-checkbox', { label: '顶部全选' })
await page.waitForTimeout(700)
console.log('AFTER-PICK-ALL', JSON.stringify(await read(), null, 2))
await page.screenshot({ path: DIR + '/round-12-pickall-on.png' })

// 再取消其中一行 → 应变成三态的中间态
await page.evaluate(() => {
  const box = document.querySelector('.gl-doc .el-table__body tr .el-checkbox')
  box?.click()
})
await page.waitForTimeout(600)
console.log('AFTER-UNCHECK-ONE', JSON.stringify(await read()))
await page.screenshot({ path: DIR + '/round-12-partial.png' })

// 顶部「取消全选」
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.gl-pick-all button')].find((x) => (x.textContent || '').includes('取消全选'))
  b?.click()
})
await page.waitForTimeout(600)
console.log('AFTER-UNPICK-ALL', JSON.stringify(await read()))
