/**
 * _fill-tab-20261117.mjs — 临时把测试库某面板的**某一张表**填到指定用量(给「本表已满」界面取证用)。
 * 用法:node _fill-tab-20261117.mjs fill 5 [panel] [tab]   # 再加 5 列
 *      node _fill-tab-20261117.mjs retire [panel] [tab]    # 删掉本脚本造的所有「验证满*」列 + 标准库条目
 * 默认 panel=QC_INSP_REQ_SERIES / tab=阻垢系列(2026-11-17 第一轮);
 * 另一个来料检验要求:node _fill-tab-20261117.mjs fill 20 QC_INSP_REQ PP管
 * ⚠ 只动测试库(HSDZ_MES_TEST),标签前缀固定 `验证满`,清理只删这个前缀。
 */
const BASE = 'http://127.0.0.1:8090/api'
const mode = process.argv[2] || 'fill'
const n = Number(process.argv[3] || 5)
const PANEL = process.argv[4] || 'QC_INSP_REQ_SERIES'
const TAB = process.argv[5] || '阻垢系列'
const PREFIX = '验证满'

const login = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.token}` }
const post = async (url, body) => (await fetch(BASE + url, { method: 'POST', headers: auth, body: JSON.stringify(body) })).json()
const get = async (url) => (await fetch(BASE + url, { headers: auth })).json()
const used = async () => ((await get(`/px/extFields?panel=${PANEL}`)).data.tabPools[TAB].used)

if (mode === 'fill') {
  console.log('起始', await used())
  for (let i = 1; i <= n; i++) {
    const label = PREFIX + String(Date.now()).slice(-4) + '-' + i
    const r = await post('/px/extField/add', { panel: PANEL, tab: TAB, label, dataType: '文本', place: 'detail' })
    console.log(i, label, '→', r.code, r.data?.colName || r.message)
  }
  console.log('现在', await used())
} else {
  const ov = (await get(`/px/extFields?panel=${PANEL}`)).data
  const mine = (ov.fields || []).filter((f) => String(f.label || '').startsWith(PREFIX))
  for (const f of mine) console.log('retire', f.label, f.col, '→', (await post('/px/extField/retire', { panel: PANEL, fieldId: f.id })).code)
  const lib = (await get('/stdlib/list?lib=qc.insp_item&all=1')).data || []
  for (const h of lib.filter((x) => String(x.content || '').startsWith(PREFIX))) {
    console.log('destroy stdlib', h.id, h.content, '→', (await post('/stdlib/destroy', { id: h.id })).code)
  }
  console.log('现在', await used())
}
