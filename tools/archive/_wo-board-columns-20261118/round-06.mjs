// round-06:验收断言 —— 日期列整组落在「大于15天已排」之后、「未交量」之前;冻结区四列在最左且 sticky
const task = await taskSpace('wo-board-column-settings-20261118')
const page = task.page('p1')

const seq = await page.evaluate(() => [...document.querySelectorAll('.el-table__header th')].map((th) => {
  const dp = th.querySelector('.dp-date')
  const label = (th.querySelector('.cell') || {}).textContent || ''
  return dp ? `__date__${dp.textContent.trim()}` : label.replace(/\s+/g, ' ').trim()
}))
const idx = (x) => seq.indexOf(x)
const report = {
  列序: seq,
  断言: {
    冻结区在前: JSON.stringify(seq.slice(1, 6)) === JSON.stringify(['工单号', '产品编码', '产品规格', '订单数量', '客户']),
    日期在大于15天已排之后: idx('大于15天已排') > -1 && idx('大于15天已排') < seq.findIndex((x) => x.startsWith('__date__')),
    日期在未交量之前: seq.findIndex((x) => x.startsWith('__date__')) < idx('未交量'),
    生产状态在最后: seq[seq.length - 1] === '生产状态',
  },
}
console.log(JSON.stringify(report, null, 2))
