// round-18:从 DOM 元素拿组件实例,读 stdLibOpts
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('about:blank')
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN?new=1', { timeout: 60000 })
await page.waitForTimeout(9000)
console.log(JSON.stringify(await page.evaluate(() => {
  const el = document.querySelector('.rsp-dt-table') || document.querySelector('table.rs-dt')
  let c = el && el.__vueParentComponent
  let hops = 0
  while (c && hops < 30) {
    const st = c.setupState || {}
    if ('stdLibOpts' in st) {
      return {
        hops,
        panelCode: st.panelCode || (c.props && c.props.panelCode),
        libs: Object.keys(st.stdLibOpts || {}),
        opts: JSON.parse(JSON.stringify(st.stdLibOpts || {})),
        stdLibVisible: st.stdLibVisible,
      }
    }
    c = c.parent
    hops++
  }
  return { hops, found: false, hasEl: !!el }
}), null, 2))
