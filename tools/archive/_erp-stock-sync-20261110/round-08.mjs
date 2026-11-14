// round-08:打印工具栏全部动作(span.tb-main)与当前选中行
const task = await taskSpace('stock-sync-kingdee-20261110')
const page = task.page('p1')

const info = await page.evaluate(() => ({
  toolbar: [...document.querySelectorAll('span.tb-main')].map((el) => ({
    t: (el.textContent || '').replace(/\s+/g, ' ').trim(),
    parentCls: String((el.parentElement || {}).className || '').slice(0, 50),
    disabled: String((el.parentElement || {}).className || '').includes('disabled'),
  })),
  selectedRow: [...document.querySelectorAll('tbody tr')].filter((tr) => tr.className.includes('current-row') || tr.className.includes('highlight'))
    .map((tr) => [...tr.querySelectorAll('td')].slice(0, 6).map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())),
  msg: [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').trim()),
}))
console.log(JSON.stringify(info, null, 1).slice(0, 2000))
