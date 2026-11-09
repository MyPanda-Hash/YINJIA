const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
// 把页面真实会提交的载荷(含 __k / 手机照片 列)抓出来,供接口侧复现
const payload = await page.evaluate(() => {
  const el = document.querySelector('.labm')
  const inst = el?.__vueParentComponent
  const st = inst?.setupState || {}
  const val = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v)
  const rows = val(st.detailRows) || []
  const heads = val(st.headerFields) || []
  const form = val(st.form) || {}
  const out = {}
  for (const f of heads) {
    const k = f.code || f.dataName
    if (!k || ['单据编号', '单据状态', '编号', '创建时间', '更新时间'].includes(k)) continue
    out[k] = form[k] == null ? '' : form[k]
  }
  const no = val(st.editingNo)
  if (no) out['编号'] = no
  out.detail = { items: rows.map((r) => ({ ...r })) }
  return { payload: out, fields: heads.map((h) => h.code), rowCount: rows.length }
})
console.log(JSON.stringify(payload, null, 2))
