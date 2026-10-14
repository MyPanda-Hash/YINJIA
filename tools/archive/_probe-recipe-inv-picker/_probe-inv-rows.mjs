/**
 * 探针(只读):配方计算弹窗「物料编号」下拉的取数事实。
 * ① bs_inv 经 /api/px/queryFormDataList(panelCode=INV)到底返回多少行
 * ② pageSize 是否真的是行数上限(queryArchive 里被忽略?)
 * ③ 所属类别的真实值域 —— 与引擎 groupOfMaterialType 认的词对比
 * ④ 折算物料的 M-001 / M-003 是否存在
 */
const BASE = 'http://127.0.0.1:8090/api'

const lg = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = lg?.data?.token
if (!token) { console.log('LOGIN FAIL', JSON.stringify(lg).slice(0, 300)); process.exit(1) }
console.log('login ok, token len', String(token).length)

const post = async (path, body) => {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  return j
}

function itemsOf(res) {
  const list = res?.list || []
  const out = []
  for (const doc of list) {
    const it = doc?.detail?.items
    if (Array.isArray(it)) out.push(...it)
    else out.push(doc)
  }
  return out
}

for (const ps of [5, 50, 200, 1000]) {
  const t0 = Date.now()
  const res = await post('/px/queryFormDataList', { panelCode: 'INV', condition: {}, pageNo: 1, pageSize: ps })
  const d = res?.data
  const items = itemsOf(d)
  console.log(`pageSize=${ps} → totalSize=${d?.totalSize} items=${items.length} ms=${Date.now() - t0} keys0=${items[0] ? Object.keys(items[0]).length : 0}`)
  if (ps === 1000) {
    const kinds = {}
    for (const r of items) {
      const k = String(r['所属类别'] ?? '').trim()
      kinds[k] = (kinds[k] || 0) + 1
    }
    console.log('所属类别 值域:', JSON.stringify(kinds, null, 0))
    const codes = ['M-001', 'M-003']
    for (const c of codes) {
      const hit = items.filter((r) => String(r['存货编码'] ?? '').trim() === c)
      console.log(`  ${c} → ${hit.length} 行`, hit.map((h) => `${h['存货名称']}/${h['所属类别']}/水分=${h['水分含量']}`).join(' | '))
    }
    console.log('前 5 行样本:', JSON.stringify(items.slice(0, 5).map((r) => ({ 存货编码: r['存货编码'], 存货名称: r['存货名称'], 所属类别: r['所属类别'], 水分含量: r['水分含量'] })), null, 0))
    const withEmptyCode = items.filter((r) => !String(r['存货编码'] ?? '').trim()).length
    const withEmptyName = items.filter((r) => !String(r['存货名称'] ?? '').trim()).length
    console.log(`空存货编码=${withEmptyCode} 空存货名称=${withEmptyName}`)
  }
}
