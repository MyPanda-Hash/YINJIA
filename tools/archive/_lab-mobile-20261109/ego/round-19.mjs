const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
const out = await page.evaluate(() => {
  const el = document.querySelector('.rsp-sheet')
  const inst = el.__vueParentComponent
  const st = inst.setupState || {}
  const val = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v)
  const head = val(st.props?.head) || inst.props?.head || {}
  const cfg = val(st.cfg) || {}
  return {
    headKeys: Object.keys(head).slice(0, 30),
    headDoc: { a: head['单据编号'], b: head['编号'], c: head['文档编号'] },
    headSample: Object.fromEntries(Object.entries(head).slice(0, 8).map(([k, v]) => [k, String(v).slice(0, 30)])),
    cfgKeys: Object.keys(cfg).slice(0, 20),
    effGridLen: (val(st.effGrid) || []).length,
    effPlain: val(st.effPlain),
    activePage: val(st.activePage),
  }
})
console.log(JSON.stringify(out, null, 2))
