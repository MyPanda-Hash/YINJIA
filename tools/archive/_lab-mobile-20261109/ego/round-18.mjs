const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
const out = await page.evaluate(() => {
  const el = document.querySelector('.rsp-sheet')
  if (!el) return { err: 'no sheet' }
  const inst = el.__vueParentComponent || el.__vueInstance
  if (!inst) return { err: 'no instance', keys: Object.keys(el).filter((k) => k.startsWith('__')) }
  const st = inst.setupState || {}
  const pick = (k) => {
    try {
      const v = st[k]
      if (v && typeof v === 'object' && 'value' in v) return JSON.stringify(v.value)?.slice(0, 400)
      return JSON.stringify(v)?.slice(0, 400)
    } catch (e) { return 'ERR ' + e.message }
  }
  return {
    hasSetupState: !!inst.setupState,
    setupKeys: Object.keys(st).slice(0, 60),
    spareAttachList: pick('spareAttachList'),
    sheetDocNo: pick('sheetDocNo'),
    gridW: pick('gridW'),
    fieldsLen: Array.isArray(st.fields?.value ?? st.fields) ? (st.fields?.value ?? st.fields).length : null,
    propsFieldsSample: (() => {
      const p = inst.props?.fields
      if (!Array.isArray(p)) return null
      return p.slice(0, 8).map((f) => ({ dn: f.dataName, c: f.code, dt: f.dataType }))
    })(),
  }
})
console.log(JSON.stringify(out, null, 2))
