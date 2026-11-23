// round-48: 查询对话框内字段位置(修复后重排)
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
console.log(JSON.stringify(await page.evaluate(() => {
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2) } }
  const labels = [...document.querySelectorAll('.header-query-dialog label, .header-query-dialog .el-form-item__label')].map((l) => ({ t: (l.textContent || '').trim(), ...rect(l) }))
  const inputs = [...document.querySelectorAll('.header-query-dialog input.el-input__inner')].map((i, idx) => ({ idx, v: i.value, ...rect(i) }))
  return { labels: labels.slice(0, 16), inputs: inputs.slice(0, 20) }
}), null, 1))
