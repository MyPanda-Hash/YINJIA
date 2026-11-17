// round-17:读组件实例状态(stdLibOpts / panelCode),确认 loadStdLibs 是否拿到新库
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('about:blank')
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN?new=1', { timeout: 60000 })
await page.waitForTimeout(9000)
console.log(JSON.stringify(await page.evaluate(() => {
  const app = document.querySelector('#app').__vue_app__
  const hits = []
  const walk = (vnode, depth) => {
    if (!vnode || depth > 60) return
    const inst = vnode.component
    if (inst && inst.setupState && ('stdLibOpts' in inst.setupState)) {
      const st = inst.setupState
      hits.push({
        panelCode: st.__v_raw ? null : null,
        libKeys: Object.keys(st.stdLibOpts || {}),
        opts: JSON.parse(JSON.stringify(st.stdLibOpts || {})),
      })
    }
    walk(vnode.subTree, depth + 1)
    const ch = vnode.children
    if (Array.isArray(ch)) ch.forEach((c) => walk(c, depth + 1))
  }
  walk(app._instance?.subTree, 0)
  return { found: hits.length, hits }
}), null, 2))
