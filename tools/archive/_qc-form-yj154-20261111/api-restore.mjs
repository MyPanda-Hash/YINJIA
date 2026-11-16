// api-restore:把测试账套 ZC-2026-10-0126 的 6 行原始明细补回(本次验证把行软删了)
const BASE = 'http://127.0.0.1:8090/api'
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/lead-qc-yj154-20261111'
const DOC = 'ZC-2026-10-0126'
const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
const token = login?.data?.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const getDesc = async () => {
  const r = await fetch(`${BASE}/px/getFormDescriptor?panelCode=QC_PROC_INSP&code=${DOC}`, { headers: { Authorization: 'Bearer ' + token } }).then((x) => x.json())
  const d = r?.data || r
  return { head: d?.data || {}, items: (d?.detailData?.items || []) }
}
const orig = JSON.parse(await fs.readFile(`${OUT}/orig-doc.json`, 'utf8'))
const items = orig.detailData.items.map((r, i) => {
  const row = { ...r, 行号: i + 1 }
  delete row.id
  return row
})
const cur = await getDesc()
const formData = { ...cur.head, 内部批次清单: '', 表单审核人: '', detail: { items } }
const save = await fetch(`${BASE}/px/callButton`, { method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'QC_PROC_INSP', buttonName: '保存为草稿', formData }) }).then((x) => x.json())
const after = await getDesc()
console.log(JSON.stringify({ save: { code: save.code, msg: save.message }, rows: after.items.length, sample: after.items.slice(0, 2).map((r) => ({ 检验项目: r['检验项目'], 行号: r['行号'], 内部批次: r['内部批次'] })), head清单: after.head['内部批次清单'], 表单审核人: after.head['表单审核人'] }))
