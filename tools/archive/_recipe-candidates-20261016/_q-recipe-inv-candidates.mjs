/**
 * _q-recipe-inv-candidates.mjs — 「配方计算」弹窗物料候选取数取证(只读)
 *
 * 弹窗口径(见 frontend/src/core/panel/invCarry.js · invSearchRequest):
 *   POST /api/px/queryFormDataList { panelCode:'INV', keyword:<关键字>, condition:{}, pageNo:1, pageSize:50 }
 *   → 商品档案(bs_inv)全量返回「一张虚拟单」{list:[{detail:{items:[...]}}]} → 前端按「物料种类」本地收窄。
 * 本脚本把「接口到底回了什么」摊开:行数、三列是否在、所属类别取值分布、关键字命中数。
 *
 * 用法: node tools/archive/_recipe-candidates-20261016/_q-recipe-inv-candidates.mjs <baseUrl> [关键字]
 *   例: node .../... http://127.0.0.1:8090 003
 *       node .../... http://36.140.66.163:8090 003
 */
const base = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const kw = process.argv[3] || '003'
const API = base + '/api'

const post = async (p, body, token) => {
  const r = await fetch(API + p, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}),
  })
  return { status: r.status, json: await r.json().catch(() => null) }
}

const lg = await post('/auth/login', { userName: 'admin', password: '123456' })
if (lg.json?.code !== 200) { console.log(`[登录失败] HTTP ${lg.status} ${JSON.stringify(lg.json).slice(0, 160)}`); process.exit(1) }
const token = lg.json.data.token
console.log(`== ${base} 登录 OK ==`)

// 商品档案面板配置(有列才有下拉可用)
const cfg = await (await fetch(`${API}/px/getPanelConfig?panelCode=INV`, { headers: { Authorization: 'Bearer ' + token } })).json()
const fields = (cfg?.data?.metadata?.panelPageDto?.tablePages?.[0]?.formFields || cfg?.data?.metadata?.panelPageDto?.tablePages?.[0]?.queryFields || []).map((f) => f.dataName)
console.log(`INV 表头字段(前 12): ${JSON.stringify((fields || []).slice(0, 12))}`)
if (cfg?.code !== 200) console.log(`  ⚠ getPanelConfig 返回 ${cfg?.code} ${String(cfg?.message || '').slice(0, 120)}`)

for (const keyword of [kw, '']) {
  const q = await post('/px/queryFormDataList', { panelCode: 'INV', keyword, condition: {}, pageNo: 1, pageSize: 50 }, token)
  const data = q.json?.data
  const first = (data?.list || [])[0] || {}
  const detailKeys = first?.detail ? Object.keys(first.detail) : []
  const rows = []
  for (const r of data?.list || []) {
    const items = r?.detail?.items
    if (Array.isArray(items)) rows.push(...items); else rows.push(r)
  }
  const has = (k) => rows.filter((r) => String(r?.[k] ?? '').trim() !== '').length
  const kinds = {}
  for (const r of rows) { const k = String(r?.['所属类别'] ?? '(空)'); kinds[k] = (kinds[k] || 0) + 1 }
  console.log(`\n-- keyword=${JSON.stringify(keyword)} → HTTP ${q.status} code=${q.json?.code} totalSize=${data?.totalSize ?? '?'} list=${(data?.list || []).length} 行=${rows.length}`)
  console.log(`   ★ 包装体键: ${JSON.stringify(Object.keys(first))}`)
  console.log(`   ★ detail 下的 tabKey: ${JSON.stringify(detailKeys)}  ← 前端 invRowsOf 只认 'items'`)
  if (detailKeys.length) console.log(`   detail['${detailKeys[0]}'] 长度: ${Array.isArray(first.detail[detailKeys[0]]) ? first.detail[detailKeys[0]].length : typeof first.detail[detailKeys[0]]}`)
  console.log(`   非空: 存货编码 ${has('存货编码')} · 存货名称 ${has('存货名称')} · 所属类别 ${has('所属类别')}`)
  console.log(`   所属类别分布: ${JSON.stringify(Object.entries(kinds).slice(0, 12))}`)
  console.log(`   样例: ${JSON.stringify(rows.slice(0, 2).map((r) => ({ 编码: r['存货编码'], 名称: r['存货名称'], 类别: r['所属类别'] })))}`)
}
