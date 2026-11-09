// round-25: 紧凑输出工具栏分组(标签|disabled)
const task = await taskSpace('erp-already-prompt-20261109')
const page = task.page('p1')
await page.waitForTimeout(300)
const out = await page.evaluate(() =>
  [...document.querySelectorAll('.tools .tb-group')].map((g) => {
    const name = ((g.querySelector('.act-name') || {}).textContent || '').trim()
    const cls = ((g.querySelector('.tb-main') || {}).className || '')
    return name + (cls.includes('disabled') ? '(灰)' : '')
  }).join(' | '))
console.log('GROUPS: ' + out)
