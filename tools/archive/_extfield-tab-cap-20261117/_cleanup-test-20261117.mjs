/**
 * _cleanup-test-20261117.mjs — 清掉本任务在**测试库**留下的验证残留(可反复跑)。
 * 只处理本任务造的标签前缀:验证满 / 验证法 / 验证标 / 验证列(不动别的数据,尤其不动「验证数据」)。
 * 用法:node tools/archive/_extfield-tab-cap-20261117/_cleanup-test-20261117.mjs
 */
const BASE = 'http://127.0.0.1:8090/api'
const PREFIXES = ['验证满', '验证法', '验证标', '验证列']
const PANELS = ['QC_INSP_REQ', 'QC_INSP_REQ_SERIES']
const isMine = (s) => PREFIXES.some((p) => String(s || '').startsWith(p))

const login = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.token}` }
const post = async (url, body) => (await fetch(BASE + url, { method: 'POST', headers: auth, body: JSON.stringify(body) })).json()
const get = async (url) => (await fetch(BASE + url, { headers: auth })).json()

for (const panel of PANELS) {
  const ov = (await get(`/px/extFields?panel=${panel}`)).data
  const mine = (ov.fields || []).filter((f) => isMine(f.label))
  const before = JSON.stringify(Object.fromEntries(Object.entries(ov.tabPools || {}).map(([k, v]) => [k, v.used])))
  for (const f of mine) {
    const r = await post('/px/extField/retire', { panel, fieldId: f.id })
    console.log(`retire ${panel} ${f.label} ${f.col} → ${r.code} ${r.message}`)
  }
  const after = (await get(`/px/extFields?panel=${panel}`)).data
  console.log(`${panel}: ${mine.length} 列已退绑 | 各表用量 ${before} → ${JSON.stringify(Object.fromEntries(Object.entries(after.tabPools || {}).map(([k, v]) => [k, v.used])))}`)
}

const lib = (await get('/stdlib/list?lib=qc.insp_item&all=1')).data || []
for (const h of lib.filter((x) => isMine(x.content))) {
  console.log(`destroy stdlib ${h.id} ${h.content} → ${(await post('/stdlib/destroy', { id: h.id })).code}`)
}
console.log('标准库残留 =', ((await get('/stdlib/list?lib=qc.insp_item&all=1')).data || []).filter((x) => isMine(x.content)).length)
