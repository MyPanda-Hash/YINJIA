/**
 * _q-drift-detail.mjs — 对差集里最值得看的几个面板做「到底差什么」的取证(只读)
 * 用法: node tools/archive/_server-drift-20261016/_q-drift-detail.mjs
 */
const LOCAL = 'http://127.0.0.1:8090', REMOTE = 'http://36.140.66.163:8090'
const login = async (b) => (await (await fetch(b + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()).data.token
const [tl, tr] = [await login(LOCAL), await login(REMOTE)]
const q = async (base, token, panelCode, size = 5) => {
  const j = await (await fetch(base + '/api/px/queryFormDataList', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode, condition: {}, pageNo: 1, pageSize: size }),
  })).json()
  const row = j?.data?.list?.[0] || {}
  const key = Object.keys(row.detail || {})[0]
  return { total: j?.data?.totalSize, key, rows: (row.detail?.[key] || []).slice(0, size), code: j?.code }
}
for (const p of ['QC_ITEM', 'QC_PLAN', 'QC_INSP_REQ', 'MATGRP', 'WLBOM', 'QC_FIRST_INSP']) {
  const [l, r] = [await q(LOCAL, tl, p), await q(REMOTE, tr, p)]
  const pick = (x) => x.rows.map((row) => row['编码'] || row['名称'] || row['检验项目'] || row['物料编号'] || row['存货编码'] || Object.values(row)[1] || '').slice(0, 4).join(' | ')
  console.log(`\n== ${p} ==`)
  console.log(`  本地   ${String(l.total).padStart(5)} 行 (detail.${l.key})  ${pick(l)}`)
  console.log(`  服务器 ${String(r.total).padStart(5)} 行 (detail.${r.key})  ${pick(r)}`)
}
