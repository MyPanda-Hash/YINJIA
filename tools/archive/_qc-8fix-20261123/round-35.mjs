// round-35: 诊断查询面板输入与按钮状态
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
console.log(JSON.stringify(await page.evaluate(() => {
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
  const inputs = [...document.querySelectorAll('input.el-input__inner')].map((i, idx) => ({ idx, val: i.value, ph: i.placeholder || '', ...rect(i), inView: i.offsetParent !== null }))
  const btns = [...document.querySelectorAll('button, .el-button')].filter((b) => ['查询', '重置', '取消'].includes((b.innerText || '').trim())).map((b) => ({ t: b.innerText.trim(), cls: String(b.className), disabled: b.disabled, ...rect(b) }))
  const items = [...document.querySelectorAll('.el-form-item')].slice(0, 20).map((it) => ({ text: (it.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 20), ...rect(it) }))
  return { inputs, btns, items, active: document.activeElement?.outerHTML?.slice(0, 160) }
}), null, 1))
