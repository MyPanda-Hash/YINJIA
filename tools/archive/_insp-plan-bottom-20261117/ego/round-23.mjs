// round-23:点开之前读 ElSelect 实例的选项注册表(states.options)与 vnode 子节点数量
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('about:blank')
await page.goto('http://localhost:5173/?cb=' + Date.now() + '#/panelx/list/RD_INSP_PLAN?new=1', { timeout: 60000 })
await page.waitForTimeout(10000)
await page.evaluate(() => { document.querySelectorAll('.el-dialog__headerbtn').forEach((b) => b.click()) })
await page.waitForTimeout(600)
await page.evaluate(() => { const a = document.querySelector('.rs-add'); if (a) a.click() })
await page.waitForTimeout(2000)
console.log(JSON.stringify(await page.evaluate(() => {
  const sel = document.querySelector('table.rs-dt td.rs-td .el-select')
  if (!sel) return { noSel: true }
  const inst = sel.__vueParentComponent
  if (!inst) return { noInst: true }
  const st = inst.setupState || {}
  const out = {
    instName: inst.type && inst.type.name,
    stateKeys: Object.keys(st).slice(0, 60),
  }
  try {
    if (st.states) {
      out.optionMapSize = st.states.options ? st.states.options.size : null
      out.optionArrLen = st.states.optionsArray ? st.states.optionsArray.length : null
    }
    if (st.options) out.optionsAttr = Array.isArray(st.options) ? st.options.length : typeof st.options
  } catch (e) { out.err = e.message }
  // slot 输出的 vnode 数量
  const kids = []
  const collect = (vn) => {
    if (!vn) return
    const c = vn.component
    if (c && c.type && c.type.name === 'ElOption') kids.push(c.props && c.props.label)
    if (Array.isArray(vn.children)) vn.children.forEach((x) => (x && x.component ? collect(x) : null))
    if (vn.subTree) collect(vn.subTree)
  }
  collect(inst.subTree)
  out.optionVnodes = kids
  return out
}), null, 2))
