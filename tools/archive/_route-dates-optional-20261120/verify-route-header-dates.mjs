const task = await taskSpace('plan-board-20261119')
const page = task.page('p1')
const info = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('.fields.header-fields label')]
  const pick = labels.filter((l) => ['生效日期', '失效日期', '工艺路线编码', '工艺路线名称'].some((k) => l.textContent.includes(k)))
  return {
    reqAll: labels.filter((l) => l.classList.contains('req')).map((l) => l.textContent.trim()),
    picks: pick.map((l) => ({ t: l.textContent.trim(), req: l.classList.contains('req') })),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-plan-board-20261119/route-header-dates-8090.png' })
