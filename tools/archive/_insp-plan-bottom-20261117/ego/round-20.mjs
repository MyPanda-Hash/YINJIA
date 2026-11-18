// round-20:把第一行各格 HTML、popper HTML、ElSelect 实例状态都打出来
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
// 复用当前打开的页面(不重载,保持刚点开下拉的状态)
const box = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('table.rs-dt tbody tr')].find((r) => r.querySelector('td.rs-td .el-select'))
  if (!tr) return null
  const td = [...tr.querySelectorAll('td.rs-td')].find((x) => x.querySelector('.el-select'))
  const r = td.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
console.log('box:', JSON.stringify(box))
if (box) { await page.mouse.click(box.x, box.y); await page.waitForTimeout(1800) }
console.log(JSON.stringify(await page.evaluate(() => {
  const sel = document.querySelector('table.rs-dt td.rs-td .el-select')
  const popper = [...document.querySelectorAll('.el-select-dropdown')].filter((p) => p.getBoundingClientRect().height > 0)[0]
  let inst = sel && sel.__vueParentComponent
  let info = null
  try {
    const st = inst && (inst.setupState || {})
    const ctx = inst && inst.ctx
    info = {
      keys: Object.keys(st).slice(0, 40),
      options: st.optionsArray ? JSON.parse(JSON.stringify(st.optionsArray)) : (st.options ? 'has options' : null),
      props: sel && sel.id,
    }
  } catch (e) { info = 'err ' + e.message }
  return {
    cellHtml: sel ? sel.outerHTML.slice(0, 400) : null,
    popperHtml: popper ? popper.outerHTML.slice(0, 800) : null,
    instInfo: info,
    allPoppers: [...document.querySelectorAll('.el-popper')].filter((p) => p.getBoundingClientRect().height > 0).map((p) => ({ cls: p.className.slice(0, 60), text: (p.textContent || '').replace(/\s+/g, ' ').slice(0, 60) })),
  }
}), null, 2))
