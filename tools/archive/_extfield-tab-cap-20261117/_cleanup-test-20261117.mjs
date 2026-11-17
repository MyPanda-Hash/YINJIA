/**
 * _cleanup-test-20261117.mjs — 清掉「自定义列上限」验证在**测试库**留下的残留。
 * 只处理本任务造出来的东西(列 备用15/备用16 + 检验项标准库 3 条验证条目),不动别人的数据。
 * 用法:node tools/archive/_extfield-tab-cap-20261117/_cleanup-test-20261117.mjs
 */
const BASE = 'http://127.0.0.1:8090/api'
const login = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.token}` }
const post = async (url, body) => (await fetch(BASE + url, { method: 'POST', headers: auth, body: JSON.stringify(body) })).json()
const get = async (url) => (await fetch(BASE + url, { headers: auth })).json()

// 1) 退绑验证列(备用15/备用16)
const ov = (await get('/px/extFields?panel=QC_INSP_REQ_SERIES')).data
const mine = (ov.fields || []).filter((f) => /^验证/.test(String(f.label || '')))
for (const f of mine) {
  const r = await post('/px/extField/retire', { panel: 'QC_INSP_REQ_SERIES', fieldId: f.id })
  console.log('retire', f.label, f.col, '→', r.code, r.message)
}

// 2) 彻底删掉验证用的检验项标准库条目
const lib = (await get('/stdlib/list?lib=qc.insp_item&all=1')).data || []
const hits = lib.filter((x) => /^验证/.test(String(x.content || '').trim()))
for (const h of hits) {
  const r = await post('/stdlib/destroy', { id: h.id })
  console.log('destroy stdlib', h.id, h.content, '→', r.code, r.message)
}

// 3) 复核
const after = (await get('/px/extFields?panel=QC_INSP_REQ_SERIES')).data
console.log('余下动态字段 =', after.fields.length, '| 每表:', JSON.stringify(Object.fromEntries(Object.entries(after.tabPools).map(([k, v]) => [k, v.used + '/' + v.capacity]))))
console.log('标准库残留 =', ((await get('/stdlib/list?lib=qc.insp_item&all=1')).data || []).filter((x) => /^验证/.test(String(x.content || '').trim())).length)
