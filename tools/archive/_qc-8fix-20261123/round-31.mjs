// round-31: 鼠标: 在明细表查询区点「单据编号」输入并查询
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
const info = await page.evaluate(() => {
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2) } }
  const labels = [...document.querySelectorAll('.el-form-item__label, .filter-label, .qf-label, label')].map((l) => ({ t: (l.textContent || '').trim(), ...rect(l) }))
  const inputs = [...document.querySelectorAll('input.el-input__inner')].map((i, idx) => ({ idx, ph: i.placeholder || '', ...rect(i), visible: i.offsetParent !== null }))
  return { labels: labels.slice(0, 20), inputs: inputs.slice(0, 20) }
})
console.log(JSON.stringify(info, null, 1))
