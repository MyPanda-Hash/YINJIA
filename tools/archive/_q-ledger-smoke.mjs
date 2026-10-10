/**
 * _q-ledger-smoke.mjs — 两账套冒烟:登录(工厂 YJ / YJ_TEST)后逐面板查一次数据,确认对齐改动没把功能弄坏
 * 用法: node tools/archive/_q-ledger-smoke.mjs [http://127.0.0.1:8090]
 */
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '') + '/api'
const PANELS = ['QC_RECV', 'QC_INSP', 'QC_RETURN', 'PURCHASE_IN']

const post = async (p, body, token) => {
  const r = await fetch(BASE + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  })
  return { status: r.status, json: await r.json().catch(() => null) }
}

for (const [label, factory] of [['正式账套 YJ', undefined], ['测试账套 YJ_TEST', 'YJ_TEST']]) {
  const login = await post('/auth/login', { userName: 'admin', password: '123456', ...(factory ? { factory } : {}) })
  if (login.json?.code !== 200) { console.log(`[FAIL] ${label} 登录失败: ${JSON.stringify(login.json).slice(0, 120)}`); continue }
  const token = login.json.data.token
  const out = []
  for (const p of PANELS) {
    const q = await post('/px/queryFormDataList', { panelCode: p, pageNo: 1, pageSize: 1, condition: {} }, token)
    const row = q.json?.data?.list?.[0]
    const detailKey = Object.keys(row?.detail || {})[0]
    const detailRows = Array.isArray(row?.detail?.[detailKey]) ? row.detail[detailKey].length : 0
    out.push(`${p}:${q.status}/${q.json?.data?.total ?? '?'}单(明细${detailKey || '-'} ${detailRows}行)`)
  }
  console.log(`[${label}] ` + out.join('  '))
}
