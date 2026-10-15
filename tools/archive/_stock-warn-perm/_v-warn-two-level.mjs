/**
 * _v-warn-two-level.mjs — 验「库存明细预警:先统一设置,再单独设置」(测试账套,跑完把值恢复为 0)
 * 用法:node tools/archive/_stock-warn-perm/_v-warn-two-level.mjs
 */
const API = 'http://127.0.0.1:8090'
const WZ = process.argv[2] || 'YJ-SX-043'
const CK = process.argv[3] || 'CK00006'

const login = await (await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
const token = login.data.token
if (!token) throw new Error('登录失败: ' + JSON.stringify(login))
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return { raw: t.slice(0, 200) } } }

const detail = async () => (await j(await fetch(
  `${API}/api/stock/monthClose/detail?period=2026-10&wzdm=${encodeURIComponent(WZ)}&ckdm=${encodeURIComponent(CK)}`, { headers: H }))).data
const warnMap = async () => (await detail())['预警']
const post = async (path, body) => j(await fetch(`${API}${path}`, { method: 'POST', headers: H, body: JSON.stringify(body) }))

const show = async (label) => {
  const m = await warnMap()
  const s = Object.entries(m || {}).map(([k, v]) => `${k || '(空)'}=${v}`).join(' ')
  console.log(`  ${label}: ${s}`)
}
console.log(`物料 ${WZ} / 仓库 ${CK}`)
await show('统一前')
console.log('  setAll(12) →', JSON.stringify((await post('/api/stock/warn/setAll', { wzdm: WZ, ckdm: CK, warnQty: 12, panel: 'STOCK_DETAIL' })).data))
await show('统一后(应全部 12)')
console.log('  set(PC0000=34) →', JSON.stringify((await post('/api/stock/warn/set', { wzdm: WZ, ckdm: CK, lot: 'PC0000', qty: 34, panel: 'STOCK_DETAIL' })).data))
await show('单独后(PC0000 应 34,其余仍 12)')
const back = await post('/api/stock/warn/setAll', { wzdm: WZ, ckdm: CK, warnQty: 0, panel: 'STOCK_DETAIL' })
console.log('  恢复 setAll(0) →', JSON.stringify(back.data))
await show('恢复后(应全 0)')
