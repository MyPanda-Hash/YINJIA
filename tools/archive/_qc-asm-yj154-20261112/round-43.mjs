// round-43:表观单(QC_ASM_INSP)落库往返验证(测试账套 ZJ-2026-10-0071):内部批次清单/内部批次/检验结果/结果判断
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
const saveDraft = (formData) => fetch(`${BASE}/px/callButton`, { method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'QC_ASM_INSP', buttonName: '保存为草稿', formData }) }).then((r) => r.json())

const orig = await getDesc()
await fs.writeFile(`${OUT}/asm-orig-doc.json`, JSON.stringify(orig, null, 2), 'utf8')
console.log('ORIG=' + JSON.stringify({ 编号: orig.head['编号'], 检测周期: orig.head['检测周期'], 检验员: orig.head['检验员'], 检验方案: orig.head['检验方案'], rows: orig.items.length, first: orig.items.slice(0, 2).map((r) => ({ 检验项目: r['检验项目'], 检验结果: r['检验结果'], 结果判断: r['结果判断'], 行号: r['行号'], id: r.id })) }))

let seq = Math.max(0, ...orig.items.map((r) => Number(r['行号']) || 0))
const expanded = []
for (const it of orig.items) {
  for (const [bi, batch] of ['261201', '261202'].entries()) {
    const row = { ...it, 内部批次: batch, 行号: ++seq, 检验结果: bi === 0 ? '无异常(第一批)' : '轻微划痕(第二批)', 结果判断: bi === 0 ? '合格' : '不合格' }
    delete row.id
    expanded.push(row)
  }
}
const save1 = await saveDraft({ ...orig.head, 内部批次清单: '261201,261202', 表单审核人: '冯敏', detail: { items: expanded } })
const after = await getDesc()
console.log('SAVE1=' + JSON.stringify({ code: save1.code, msg: save1.message }))
console.log('AFTER=' + JSON.stringify({
  内部批次清单: after.head['内部批次清单'],
  表单审核人: after.head['表单审核人'],
  检测周期: after.head['检测周期'],
  rows: after.items.length,
  byBatch: after.items.reduce((a, r) => { const b = String(r['内部批次'] || '-'); a[b] = (a[b] || 0) + 1; return a }, {}),
  firstItem: after.items.filter((r) => r['检验项目'] === orig.items[0]['检验项目']).map((r) => ({ 内部批次: r['内部批次'], 检验结果: r['检验结果'], 结果判断: r['结果判断'] })),
}))
// 还原
const restoreItems = orig.items.map((r, i) => ({ ...r, 行号: i + 1 }))
const r2 = await saveDraft({ ...orig.head, 内部批次清单: null, 表单审核人: null, detail: { items: restoreItems } })
const back = await getDesc()
console.log('RESTORE=' + JSON.stringify({ code: r2.code, rows: back.items.length, 清单: back.head['内部批次清单'], 表单审核人: back.head['表单审核人'], batches: [...new Set(back.items.map((r) => r['内部批次'] || '-'))] }))
