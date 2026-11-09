// round-24: 列出全部工具栏分组(标签 + 是否 disabled),找装「弃审」的组
const task = await taskSpace('erp-already-prompt-20261109')
const page = task.page('p1')
await page.waitForTimeout(300)
console.log(JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('.tools .tb-group')].map((g) => ({
    label: (g.querySelector('.act-name') || {}).textContent?.trim(),
    disabled: (g.querySelector('.tb-main') || {}).className?.includes?.('disabled') ?? null,
    color: (g.querySelector('.tb-main') || {}).className,
  })).slice(0, 20)), null, 2))
