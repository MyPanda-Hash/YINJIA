// round-49: 对话框输入框 rect(两列布局)
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
console.log(JSON.stringify(await page.evaluate(() => {
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2) } }
  return [...document.querySelectorAll('.header-query-dialog input.el-input__inner')].map((i, idx) => ({ idx, v: i.value, ph: i.placeholder || '', ...rect(i), row: i.closest('.el-form-item')?.innerText?.replace(/\s+/g, ' ').slice(0, 16) }))
}), null, 1))
