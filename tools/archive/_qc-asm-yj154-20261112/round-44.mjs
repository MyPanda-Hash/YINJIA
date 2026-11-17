// round-44:还原测试账套 ZJ-2026-10-0071 的 3 行原始明细(round-43 验证把行软删了)
const BASE = 'http://127.0.0.1:8090/api'
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/lead-qc-yj154-20261111'
const DOC = 'ZJ-2026-10-0071'
const login = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }) }).then((r) => r.json())
const token = login?.data?.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const getDesc = async () => {
  const r = await fetch(`${BASE}/px/getFormDescriptor?panelCode=QC_ASM_INSP&code=${DOC}`, { headers: { Authorization: 'Bearer ' + token } }).then((x) => x.json())
  const d = r?.data || r
  return { head: d?.data || {}, items: (d?.detailData?.items || []) }
}
const orig = JSON.parse(await fs.readFile(`${OUT}/asm-orig-doc.json`, 'utf8'))
const cur = await getDesc()
const items = orig.items.map((r, i) => { const row = { ...r, 行号: i + 1 }; delete row.id; return row })
const body = { ...cur.head, 内部批次清单: '', 表单审核人: '', detail: { items } }
const resp = await fetch(`${BASE}/px/callButton`, { method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'QC_ASM_INSP', buttonName: '保存为草稿', formData: body }) }).then((r) => r.json())
const back = await getDesc()
console.log(JSON.stringify({ save: { code: resp.code, msg: resp.message }, rows: back.items.length, sample: back.items.map((r) => ({ 检验项目: r['检验项目'], 检验结果: r['检验结果'], 结果判断: r['结果判断'], 内部批次: r['内部批次'] })), 清单: back.head['内部批次清单'], 表单审核人: back.head['表单审核人'] }))
