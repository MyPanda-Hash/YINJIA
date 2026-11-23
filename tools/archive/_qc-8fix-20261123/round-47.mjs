// round-47: 查询对话框字段与按钮点击诊断
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
console.log(JSON.stringify(await page.evaluate(() => {
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
  const vals = [...document.querySelectorAll('.header-query-dialog input.el-input__inner')].map((i, idx) => ({ idx, v: i.value, ph: i.placeholder || '', ...rect(i) }))
  const btn = document.querySelector('.header-query-dialog .el-dialog__footer button.el-button--primary')
  const b = btn.getBoundingClientRect()
  return {
    vals: vals.filter((v) => v.v || v.ph),
    btn: { ...rect(btn), text: btn.innerText, disabled: btn.disabled, pe: getComputedStyle(btn).pointerEvents },
    at: (() => { const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return el ? { tag: el.tagName, cls: String(el.className).slice(0, 40), text: (el.innerText || '').trim().slice(0, 8) } : null })(),
    dialogBodyH: (() => { const d = document.querySelector('.header-query-dialog .el-dialog__body'); const r = d.getBoundingClientRect(); return { y: Math.round(r.y), h: Math.round(r.height), sh: d.scrollHeight, st: d.scrollTop } })(),
    active: document.activeElement?.tagName + '.' + document.activeElement?.className,
  }
}), null, 1))
