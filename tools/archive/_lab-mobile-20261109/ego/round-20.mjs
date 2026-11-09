const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
const out = await page.evaluate(() => {
  const el = document.querySelector('.rsp-sheet')
  const inst = el.__vueParentComponent
  const props = inst.props || {}
  const head = props.head
  const safe = (v) => {
    try { return JSON.stringify(v)?.slice(0, 500) } catch (e) { return 'ERR' }
  }
  // 往上找 PanelxList 的 cur
  let p = inst
  let found = null
  for (let i = 0; i < 4 && p; i++) {
    p = p.parent
    if (!p) break
    const st = p.setupState || {}
    if (st.cur) {
      const c = st.cur.value ?? st.cur
      found = { depth: i, keys: Object.keys(c || {}).slice(0, 25), doc: safe({ a: c?.['单据编号'], b: c?.['编号'] }) }
      break
    }
  }
  return {
    propKeys: Object.keys(props),
    headIsObject: head && typeof head === 'object',
    headKeys: head ? Object.keys(head) : null,
    headJson: safe(head),
    parentCur: found,
  }
})
console.log(JSON.stringify(out, null, 2))
