// round-24: 8090 联系人下拉选项(只读当前可见的 popper)
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const tr = [...sheet.querySelectorAll('tbody > tr')].find((r) => /联系人/.test(r.textContent || ''))
  tr?.querySelector('.el-select__wrapper')?.click()
})
await T(1200)

const opts = await page.evaluate(() => {
  const poppers = [...document.querySelectorAll('.el-select__popper')].filter((p) => p.style.display !== 'none' && p.getClientRects().length)
  const p = poppers[poppers.length - 1]
  const items = p ? [...p.querySelectorAll('.el-select-dropdown__item')].map((li) => (li.textContent || '').trim()) : []
  return { poppers: poppers.length, total: items.length, head: items.slice(0, 6), hasSysAdmin: items.includes('系统管理员') }
})
console.log('contact-options=' + JSON.stringify(opts))
await page.screenshot({ path: dir + '/shots/round-24-8090-contact-opts.png' })
