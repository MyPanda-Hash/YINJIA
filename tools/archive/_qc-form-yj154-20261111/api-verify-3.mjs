// api-verify-3:修正版落库验证(复制行不带 id) + 验完还原原始数据(测试账套)
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
const saveDraft = async (formData) => {
  const r = await fetch(`${BASE}/px/callButton`, { method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'QC_PROC_INSP', buttonName: '保存为草稿', formData }) }).then((x) => x.json())
  return { code: r.code, msg: r.message }
}

const orig = JSON.parse(await fs.readFile(`${OUT}/orig-doc.json`, 'utf8'))
const origHead = orig.data
const origItems = orig.detailData.items

const cur = await getDesc()
console.log('CUR=' + JSON.stringify({ 内部批次清单: cur.head['内部批次清单'], 表单审核人: cur.head['表单审核人'], items: cur.items.length }))

// 改造:每个项目 × 2 批次;复制行**去掉 id**,行号重新发号
const expanded = []
let seq = Math.max(0, ...cur.items.map((r) => Number(r['行号']) || 0))
cur.items.forEach((r, idx) => {
  for (const [bi, batch] of ['261105', '261107'].entries()) {
    const row = { ...r, 内部批次: batch, 行号: ++seq, 实测数值: idx === 0 ? (bi === 0 ? '目视无破损' : '轻微划痕') : '', 结果判断: idx === 0 ? (bi === 0 ? '合格' : '不合格') : '' }
    delete row.id
    expanded.push(row)
  }
})
const save1 = await saveDraft({ ...cur.head, 内部批次清单: '261105,261107', 表单审核人: '冯敏', detail: { items: expanded } })
const after = await getDesc()
const byBatch = after.items.reduce((a, r) => { const b = String(r['内部批次'] || '-'); a[b] = (a[b] || 0) + 1; return a }, {})
console.log('SAVE1=' + JSON.stringify(save1))
console.log('AFTER1=' + JSON.stringify({
  内部批次清单: after.head['内部批次清单'], 表单审核人: after.head['表单审核人'], 检测周期: after.head['检测周期'],
  items: after.items.length, byBatch,
  firstItemRows: after.items.filter((r) => r['检验项目'] === '外观').map((r) => ({ 内部批次: r['内部批次'], 实测数值: r['实测数值'], 结果判断: r['结果判断'] })),
}))
await fs.writeFile(`${OUT}/verified-doc.json`, JSON.stringify(after, null, 2), 'utf8')

// 还原原始数据(测试账套不留下本次造的数)
const plainItems = origItems.map((r) => ({ ...r }))
const restored = await saveDraft({ ...origHead, 内部批次清单: null, 表单审核人: null, detail: { items: plainItems } })
const back = await getDesc()
console.log('RESTORE=' + JSON.stringify({ save: restored, 内部批次清单: back.head['内部批次清单'], 表单审核人: back.head['表单审核人'], items: back.items.length, batches: back.items.map((r) => r['内部批次'] || '-') }))
