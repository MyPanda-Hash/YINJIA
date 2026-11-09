// round-22: 看「审批」组的 DOM 结构(搞清楚下拉怎么点)
const task = await taskSpace('erp-already-prompt-20261109')
const page = task.page('p1')
await page.waitForTimeout(300)
console.log(await page.evaluate(() => {
  const main = [...document.querySelectorAll('span.tb-main')].find((s) => (s.textContent || '').trim() === '审批')
  if (!main) return 'no-main'
  const group = main.closest('.tb-group')
  return (group ? group.outerHTML : main.outerHTML).slice(0, 1200)
}))
